"""Redis Streams consumer for processing PDF jobs."""

import logging
import time
import uuid
import signal
import sys
from typing import Dict, Any, Optional

from ..config import config
from ..redis_client import get_redis_client, ensure_stream_group
from ..storage import (
    update_job_status, store_job_result, store_job_error, 
    get_job_data, cleanup_job_files, StorageError
)
from ..schemas import JobStatus, ProcessingResult, PageContent
from ..services.parsers import parse_document, ParsingError
from ..services.summarize import summarize_document_pages, SummarizationError

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global flag for graceful shutdown
shutdown_requested = False


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    global shutdown_requested
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    shutdown_requested = True


class JobProcessor:
    """Handles processing of individual jobs."""
    
    def __init__(self):
        self.worker_id = f"worker-{uuid.uuid4().hex[:8]}"
        logger.info(f"Initialized job processor with ID: {self.worker_id}")
    
    def process_job(self, job_data: Dict[str, Any]) -> None:
        """
        Process a single job from the stream.
        
        Args:
            job_data: Job data from Redis stream
        """
        job_id = job_data.get("job_id")
        if not job_id:
            logger.error("Job data missing job_id")
            return
        
        logger.info(f"Processing job {job_id}")
        
        try:
            # Update status to processing
            update_job_status(job_id, JobStatus.PROCESSING)
            
            # Get full job details from storage
            stored_job_data = get_job_data(job_id)
            if not stored_job_data:
                raise Exception(f"Job {job_id} not found in storage")
            
            parser = stored_job_data.get("parser", "pypdf")
            file_path = stored_job_data.get("file_path")
            filename = stored_job_data.get("filename", "unknown.pdf")
            
            if not file_path:
                raise Exception("File path not found in job data")
            
            logger.info(f"Processing {filename} with {parser} parser")
            
            # Parse document
            try:
                per_page_content = parse_document(file_path, parser)
                logger.info(f"Successfully parsed {len(per_page_content)} pages")
            except (ParsingError, NotImplementedError) as e:
                raise Exception(f"Parsing failed: {str(e)}")
            
            # Generate summary
            try:
                summary_md = summarize_document_pages(per_page_content)
                logger.info("Successfully generated summary")
            except SummarizationError as e:
                logger.warning(f"Summarization failed: {e}")
                summary_md = f"**Summary unavailable**: {str(e)}"
            except Exception as e:
                logger.warning(f"Unexpected summarization error: {e}")
                summary_md = f"**Summary unavailable**: Unexpected error - {str(e)}"
            
            # Create result object
            page_objects = [
                PageContent(page=item["page"], content_md=item["content_md"])
                for item in per_page_content
            ]
            
            result = ProcessingResult(
                parser=parser,
                per_page_markdown=page_objects,
                summary_md=summary_md,
                page_count=len(per_page_content)
            )
            
            # Store results
            store_job_result(job_id, result)
            
            logger.info(f"Successfully completed job {job_id}")
            
        except Exception as e:
            error_message = str(e)
            logger.error(f"Job {job_id} failed: {error_message}")
            
            try:
                store_job_error(job_id, error_message)
            except StorageError as storage_error:
                logger.error(f"Failed to store error for job {job_id}: {storage_error}")
        
        finally:
            # Clean up temporary files
            try:
                cleanup_job_files(job_id)
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup files for job {job_id}: {cleanup_error}")


class StreamConsumer:
    """Redis Streams consumer for processing jobs."""
    
    def __init__(self):
        self.client = get_redis_client()
        self.processor = JobProcessor()
        self.worker_id = self.processor.worker_id
        
        # Ensure consumer group exists
        ensure_stream_group()
        
        logger.info(f"Stream consumer initialized: {self.worker_id}")
    
    def consume_messages(self) -> None:
        """Main consumer loop."""
        logger.info(f"Starting consumer loop for stream {config.STREAM_NAME}")
        
        while not shutdown_requested:
            try:
                # Read messages from stream
                messages = self.client.xreadgroup(
                    config.STREAM_GROUP,
                    self.worker_id,
                    {config.STREAM_NAME: ">"},
                    count=1,
                    block=5000  # 5 second timeout
                )
                
                if not messages:
                    continue  # Timeout, check for shutdown
                
                # Process each message
                for stream_name, stream_messages in messages:
                    for message_id, fields in stream_messages:
                        logger.info(f"Received message {message_id} from {stream_name}")
                        
                        try:
                            # Process the job
                            self.processor.process_job(fields)
                            
                            # Acknowledge the message
                            self.client.xack(config.STREAM_NAME, config.STREAM_GROUP, message_id)
                            logger.info(f"Acknowledged message {message_id}")
                            
                        except Exception as e:
                            logger.error(f"Failed to process message {message_id}: {e}")
                            
                            # Still acknowledge to avoid reprocessing
                            # In production, you might want to move to a dead letter queue
                            self.client.xack(config.STREAM_NAME, config.STREAM_GROUP, message_id)
                            logger.warning(f"Acknowledged failed message {message_id}")
            
            except KeyboardInterrupt:
                logger.info("Received keyboard interrupt")
                break
            except Exception as e:
                logger.error(f"Error in consumer loop: {e}")
                time.sleep(5)  # Wait before retrying
        
        logger.info("Consumer loop ended")
    
    def cleanup_pending_messages(self) -> None:
        """Clean up any pending messages for this worker."""
        try:
            # Get pending messages for this consumer
            pending = self.client.xpending_range(
                config.STREAM_NAME,
                config.STREAM_GROUP,
                min="-",
                max="+",
                count=100,
                consumername=self.worker_id
            )
            
            if pending:
                logger.info(f"Found {len(pending)} pending messages for cleanup")
                
                for message in pending:
                    message_id = message["message_id"]
                    try:
                        # Acknowledge pending messages
                        self.client.xack(config.STREAM_NAME, config.STREAM_GROUP, message_id)
                        logger.info(f"Cleaned up pending message {message_id}")
                    except Exception as e:
                        logger.warning(f"Failed to cleanup message {message_id}: {e}")
        
        except Exception as e:
            logger.warning(f"Error during pending message cleanup: {e}")


def main():
    """Main entry point for the worker."""
    logger.info("Starting PDF processing worker")
    
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Create and start consumer
        consumer = StreamConsumer()
        
        # Clean up any pending messages from previous runs
        consumer.cleanup_pending_messages()
        
        # Start consuming messages
        consumer.consume_messages()
        
    except Exception as e:
        logger.error(f"Worker failed to start: {e}")
        sys.exit(1)
    
    logger.info("Worker shutdown complete")


if __name__ == "__main__":
    main()
