"""Redis client and operations for the document processing service."""

import logging
import orjson
from typing import Dict, Any, Optional, List
from datetime import datetime
import redis
from redis.exceptions import ResponseError

from .config import config

logger = logging.getLogger(__name__)

# Global Redis client instance
redis_client: Optional[redis.Redis] = None


def get_redis_client() -> redis.Redis:
    """Get or create Redis client instance."""
    global redis_client
    if redis_client is None:
        redis_client = redis.from_url(
            config.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30
        )
        # Test connection
        try:
            redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    return redis_client


def ensure_stream_group() -> None:
    """Ensure the consumer group exists for the stream."""
    client = get_redis_client()
    try:
        client.xgroup_create(
            config.STREAM_NAME,
            config.STREAM_GROUP,
            id="$",
            mkstream=True
        )
        logger.info(f"Created consumer group {config.STREAM_GROUP} for stream {config.STREAM_NAME}")
    except ResponseError as e:
        if "BUSYGROUP" in str(e):
            logger.debug(f"Consumer group {config.STREAM_GROUP} already exists")
        else:
            logger.error(f"Failed to create consumer group: {e}")
            raise


def add_job_to_stream(job_dict: Dict[str, Any]) -> str:
    """Add a job to the Redis stream."""
    client = get_redis_client()
    
    # Ensure stream group exists
    ensure_stream_group()
    
    # Add timestamp
    job_dict["created_at"] = datetime.utcnow().isoformat()
    
    # Add to stream
    message_id = client.xadd(config.STREAM_NAME, job_dict)
    logger.info(f"Added job {job_dict.get('job_id')} to stream with message ID {message_id}")
    
    return message_id


def set_job_status(job_id: str, status: str, extra: Optional[Dict[str, Any]] = None) -> None:
    """Set job status and optional extra data."""
    client = get_redis_client()
    
    job_key = f"job:{job_id}"
    data = {"status": status, "updated_at": datetime.utcnow().isoformat()}
    
    if extra:
        data.update(extra)
    
    client.hset(job_key, mapping=data)
    
    # Set TTL if configured
    if config.JOB_TTL_SECONDS > 0:
        client.expire(job_key, config.JOB_TTL_SECONDS)
    
    logger.info(f"Set job {job_id} status to {status}")


def store_result(job_id: str, result_dict: Dict[str, Any]) -> None:
    """Store job results."""
    client = get_redis_client()
    
    job_key = f"job:{job_id}"
    
    # Serialize complex data as JSON
    data = {
        "status": "done",
        "updated_at": datetime.utcnow().isoformat(),
        "parser": result_dict.get("parser"),
        "page_count": result_dict.get("page_count"),
        "summary_md": result_dict.get("summary_md", ""),
        "per_page_json": orjson.dumps(result_dict.get("per_page_markdown", [])).decode()
    }
    
    client.hset(job_key, mapping=data)
    
    # Set TTL if configured
    if config.JOB_TTL_SECONDS > 0:
        client.expire(job_key, config.JOB_TTL_SECONDS)
    
    logger.info(f"Stored results for job {job_id}")


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Get job data by ID."""
    client = get_redis_client()
    
    job_key = f"job:{job_id}"
    job_data = client.hgetall(job_key)
    
    if not job_data:
        return None
    
    # Parse JSON fields
    if "per_page_json" in job_data:
        try:
            job_data["per_page_markdown"] = orjson.loads(job_data["per_page_json"])
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


def store_error(job_id: str, error_message: str) -> None:
    """Store job error."""
    client = get_redis_client()
    
    job_key = f"job:{job_id}"
    data = {
        "status": "error",
        "error_message": error_message,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    client.hset(job_key, mapping=data)
    
    # Set TTL if configured
    if config.JOB_TTL_SECONDS > 0:
        client.expire(job_key, config.JOB_TTL_SECONDS)
    
    logger.error(f"Stored error for job {job_id}: {error_message}")


def cleanup_temp_file(file_path: str) -> None:
    """Clean up temporary file if configured."""
    if not config.KEEP_TMP_FILES:
        try:
            import os
            if os.path.exists(file_path):
                os.unlink(file_path)
                logger.debug(f"Cleaned up temporary file: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to clean up temporary file {file_path}: {e}")


def get_stream_info() -> Dict[str, Any]:
    """Get Redis stream information for debugging."""
    client = get_redis_client()
    try:
        stream_info = client.xinfo_stream(config.STREAM_NAME)
        group_info = client.xinfo_groups(config.STREAM_NAME)
        return {
            "stream": stream_info,
            "groups": group_info
        }
    except Exception as e:
        logger.error(f"Failed to get stream info: {e}")
        return {}
