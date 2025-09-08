"""Storage operations for job data and results."""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import orjson

from .redis_client import get_redis_client
from .config import config
from .schemas import JobStatus, ProcessingResult, PageContent

logger = logging.getLogger(__name__)


class StorageError(Exception):
    """Custom exception for storage operations."""
    pass


def create_job(job_id: str, parser: str, filename: str, file_path: str) -> None:
    """
    Create a new job record in storage.
    
    Args:
        job_id: Unique job identifier
        parser: Parser to use for processing
        filename: Original filename
        file_path: Path to temporary file
    """
    try:
        client = get_redis_client()
        
        job_key = f"job:{job_id}"
        job_data = {
            "job_id": job_id,
            "status": JobStatus.PENDING.value,
            "parser": parser,
            "filename": filename,
            "file_path": file_path,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        client.hset(job_key, mapping=job_data)
        
        # Set TTL if configured
        if config.JOB_TTL_SECONDS > 0:
            client.expire(job_key, config.JOB_TTL_SECONDS)
        
        logger.info(f"Created job record: {job_id}")
        
    except Exception as e:
        error_msg = f"Failed to create job {job_id}: {str(e)}"
        logger.error(error_msg)
        raise StorageError(error_msg)


def update_job_status(job_id: str, status: JobStatus, extra_data: Optional[Dict[str, Any]] = None) -> None:
    """
    Update job status and optional extra data.
    
    Args:
        job_id: Job identifier
        status: New job status
        extra_data: Optional additional data to store
    """
    try:
        client = get_redis_client()
        
        job_key = f"job:{job_id}"
        update_data = {
            "status": status.value,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if extra_data:
            update_data.update(extra_data)
        
        client.hset(job_key, mapping=update_data)
        
        logger.info(f"Updated job {job_id} status to {status.value}")
        
    except Exception as e:
        error_msg = f"Failed to update job {job_id} status: {str(e)}"
        logger.error(error_msg)
        raise StorageError(error_msg)


def store_job_result(job_id: str, result: ProcessingResult) -> None:
    """
    Store job processing results.
    
    Args:
        job_id: Job identifier
        result: Processing result data
    """
    try:
        client = get_redis_client()
        
        job_key = f"job:{job_id}"
        
        # Serialize page content as JSON
        per_page_json = orjson.dumps([
            {"page": page.page, "content_md": page.content_md}
            for page in result.per_page_markdown
        ]).decode()
        
        result_data = {
            "status": JobStatus.DONE.value,
            "parser": result.parser,
            "page_count": result.page_count,
            "summary_md": result.summary_md,
            "per_page_json": per_page_json,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        client.hset(job_key, mapping=result_data)
        
        # Set TTL if configured
        if config.JOB_TTL_SECONDS > 0:
            client.expire(job_key, config.JOB_TTL_SECONDS)
        
        logger.info(f"Stored results for job {job_id} ({result.page_count} pages)")
        
    except Exception as e:
        error_msg = f"Failed to store results for job {job_id}: {str(e)}"
        logger.error(error_msg)
        raise StorageError(error_msg)


def store_job_error(job_id: str, error_message: str) -> None:
    """
    Store job error information.
    
    Args:
        job_id: Job identifier
        error_message: Error description
    """
    try:
        client = get_redis_client()
        
        job_key = f"job:{job_id}"
        error_data = {
            "status": JobStatus.ERROR.value,
            "error_message": error_message,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        client.hset(job_key, mapping=error_data)
        
        # Set TTL if configured
        if config.JOB_TTL_SECONDS > 0:
            client.expire(job_key, config.JOB_TTL_SECONDS)
        
        logger.error(f"Stored error for job {job_id}: {error_message}")
        
    except Exception as e:
        error_msg = f"Failed to store error for job {job_id}: {str(e)}"
        logger.error(error_msg)
        raise StorageError(error_msg)


def get_job_data(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve job data by ID.
    
    Args:
        job_id: Job identifier
        
    Returns:
        Job data dictionary or None if not found
    """
    try:
        client = get_redis_client()
        
        job_key = f"job:{job_id}"
        job_data = client.hgetall(job_key)
        
        if not job_data:
            return None
        
        # Parse JSON fields
        if "per_page_json" in job_data and job_data["per_page_json"]:
            try:
                per_page_data = orjson.loads(job_data["per_page_json"])
                job_data["per_page_markdown"] = [
                    PageContent(page=item["page"], content_md=item["content_md"])
                    for item in per_page_data
                ]
                del job_data["per_page_json"]  # Remove raw JSON field
            except Exception as e:
                logger.error(f"Failed to parse per_page_json for job {job_id}: {e}")
                job_data["per_page_markdown"] = []
        
        # Convert numeric fields
        if "page_count" in job_data and job_data["page_count"]:
            try:
                job_data["page_count"] = int(job_data["page_count"])
            except (ValueError, TypeError):
                job_data["page_count"] = None
        
        return job_data
        
    except Exception as e:
        error_msg = f"Failed to retrieve job {job_id}: {str(e)}"
        logger.error(error_msg)
        raise StorageError(error_msg)


def job_exists(job_id: str) -> bool:
    """
    Check if a job exists in storage.
    
    Args:
        job_id: Job identifier
        
    Returns:
        True if job exists, False otherwise
    """
    try:
        client = get_redis_client()
        job_key = f"job:{job_id}"
        return client.exists(job_key) > 0
    except Exception as e:
        logger.error(f"Failed to check job existence {job_id}: {e}")
        return False


def get_job_status(job_id: str) -> Optional[str]:
    """
    Get job status quickly without loading all data.
    
    Args:
        job_id: Job identifier
        
    Returns:
        Job status string or None if not found
    """
    try:
        client = get_redis_client()
        job_key = f"job:{job_id}"
        return client.hget(job_key, "status")
    except Exception as e:
        logger.error(f"Failed to get job status {job_id}: {e}")
        return None


def cleanup_job_files(job_id: str) -> None:
    """
    Clean up temporary files associated with a job.
    
    Args:
        job_id: Job identifier
    """
    try:
        job_data = get_job_data(job_id)
        if job_data and "file_path" in job_data:
            file_path = job_data["file_path"]
            if file_path:
                from .utils.pdf_utils import cleanup_temp_file
                cleanup_temp_file(file_path)
    except Exception as e:
        logger.warning(f"Failed to cleanup files for job {job_id}: {e}")


def get_storage_stats() -> Dict[str, Any]:
    """
    Get storage statistics for monitoring.
    
    Returns:
        Dictionary with storage statistics
    """
    try:
        client = get_redis_client()
        
        # Get Redis info
        redis_info = client.info()
        
        # Count jobs by status
        job_keys = client.keys("job:*")
        status_counts = {}
        
        for key in job_keys:
            status = client.hget(key, "status")
            if status:
                status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            "redis_memory_used": redis_info.get("used_memory_human", "unknown"),
            "redis_connected_clients": redis_info.get("connected_clients", 0),
            "total_jobs": len(job_keys),
            "jobs_by_status": status_counts,
            "redis_version": redis_info.get("redis_version", "unknown")
        }
        
    except Exception as e:
        logger.error(f"Failed to get storage stats: {e}")
        return {"error": str(e)}
