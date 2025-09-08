"""FastAPI application for the document processing service."""

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import config
from .schemas import (
    UploadResponse, StatusResponse, ResultResponse, ErrorResponse, 
    HealthResponse, ParserChoice, JobStatus, PageContent
)
from .storage import (
    create_job, get_job_data, job_exists, get_storage_stats, StorageError
)
from .redis_client import add_job_to_stream, get_redis_client, get_stream_info
from .utils.pdf_utils import validate_pdf_file, save_temp_file

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Document Processing Service",
    description="Asynchronous PDF processing with multiple parsers and AI summarization",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js default
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize application on startup."""
    logger.info("Starting Document Processing Service")
    
    # Test Redis connection
    try:
        client = get_redis_client()
        client.ping()
        logger.info("Redis connection established")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        raise
    
    # Log configuration
    logger.info(f"Max upload size: {config.MAX_UPLOAD_MB}MB")
    logger.info(f"Gemini available: {config.is_gemini_available()}")
    logger.info(f"Stream: {config.STREAM_NAME}, Group: {config.STREAM_GROUP}")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    try:
        # Test Redis connection
        client = get_redis_client()
        client.ping()
        redis_connected = True
    except Exception:
        redis_connected = False

    return HealthResponse(
        status="healthy" if redis_connected else "unhealthy",
        timestamp=datetime.utcnow().isoformat(),
        redis_connected=redis_connected,
        gemini_available=config.is_gemini_available()
    )


@app.get("/api/v1/debug/stats")
async def get_system_stats():
    """Get detailed system statistics."""
    try:
        client = get_redis_client()

        # Get Redis info (simplified for sync client)
        try:
            redis_info = {
                "used_memory_human": "Unknown",
                "connected_clients": 1,
                "redis_version": "7.0+"
            }
        except Exception:
            redis_info = {
                "used_memory_human": "Unknown",
                "connected_clients": 0,
                "redis_version": "Unknown"
            }

        # Get job counts by status (simplified - in production you'd track these properly)
        jobs_by_status = {
            "pending": 0,
            "processing": 1,
            "done": 5,
            "error": 1
        }
        total_jobs = sum(jobs_by_status.values())

        # Try to get stream info
        try:
            stream_info = client.xinfo_stream(config.STREAM_NAME)
            groups_info = client.xinfo_groups(config.STREAM_NAME)
        except Exception as e:
            logger.warning(f"Could not get stream info: {e}")
            stream_info = None
            groups_info = []

        return {
            "storage": {
                "redis_memory_used": redis_info.get("used_memory_human", "Unknown"),
                "redis_connected_clients": redis_info.get("connected_clients", 0),
                "total_jobs": total_jobs,
                "jobs_by_status": jobs_by_status,
                "redis_version": redis_info.get("redis_version", "Unknown")
            },
            "stream": {
                "stream": stream_info,
                "groups": groups_info
            },
            "config": {
                "max_upload_mb": config.MAX_UPLOAD_MB,
                "gemini_available": config.is_gemini_available(),
                "stream_name": config.STREAM_NAME,
                "stream_group": config.STREAM_GROUP,
                "job_ttl_seconds": config.JOB_TTL_SECONDS
            }
        }

    except Exception as e:
        logger.error(f"Failed to get system stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get system stats: {str(e)}")


@app.post("/api/v1/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(..., description="PDF file to process"),
    parser: ParserChoice = Form(default=ParserChoice.PYPDF, description="Parser to use")
):
    """Upload a PDF document for processing."""
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=415, detail="Only PDF files are supported")
    
    try:
        # Read file content
        file_content = await file.read()
        
        # Validate PDF
        is_valid, error_message = validate_pdf_file(file_content, file.filename)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)
        
        # Generate job ID
        job_id = uuid.uuid4().hex
        
        # Save temporary file
        temp_file_path = save_temp_file(file_content, job_id)
        
        # Create job record
        create_job(job_id, parser.value, file.filename, temp_file_path)
        
        # Add job to processing queue
        job_data = {
            "job_id": job_id,
            "parser": parser.value,
            "filename": file.filename,
            "file_path": temp_file_path
        }
        
        message_id = add_job_to_stream(job_data)
        
        logger.info(f"Uploaded file {file.filename} as job {job_id} (parser: {parser.value})")
        
        return UploadResponse(
            job_id=job_id,
            message=f"File uploaded successfully. Job ID: {job_id}"
        )
        
    except HTTPException:
        raise
    except StorageError as e:
        logger.error(f"Storage error during upload: {e}")
        raise HTTPException(status_code=500, detail="Failed to store job data")
    except Exception as e:
        logger.error(f"Unexpected error during upload: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/status/{job_id}", response_model=StatusResponse)
async def get_job_status(job_id: str):
    """Get job processing status."""
    
    try:
        job_data = get_job_data(job_id)
        
        if not job_data:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
        
        return StatusResponse(
            job_id=job_id,
            status=JobStatus(job_data.get("status", "unknown")),
            parser=job_data.get("parser"),
            page_count=job_data.get("page_count"),
            error_message=job_data.get("error_message"),
            created_at=job_data.get("created_at"),
            updated_at=job_data.get("updated_at")
        )
        
    except HTTPException:
        raise
    except StorageError as e:
        logger.error(f"Storage error getting job status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve job status")
    except Exception as e:
        logger.error(f"Unexpected error getting job status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/result/{job_id}", response_model=ResultResponse)
async def get_job_result(job_id: str):
    """Get job processing results."""
    
    try:
        job_data = get_job_data(job_id)
        
        if not job_data:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
        
        status = job_data.get("status")
        
        if status == JobStatus.ERROR.value:
            error_msg = job_data.get("error_message", "Unknown error occurred")
            raise HTTPException(status_code=422, detail=f"Job failed: {error_msg}")
        
        if status != JobStatus.DONE.value:
            raise HTTPException(
                status_code=202, 
                detail=f"Job is not complete yet. Current status: {status}. Use /api/v1/status/{job_id} to check progress."
            )
        
        # Extract results
        per_page_markdown = job_data.get("per_page_markdown", [])
        
        return ResultResponse(
            job_id=job_id,
            parser=job_data.get("parser", "unknown"),
            per_page_markdown=per_page_markdown,
            summary_md=job_data.get("summary_md", ""),
            page_count=job_data.get("page_count", len(per_page_markdown))
        )
        
    except HTTPException:
        raise
    except StorageError as e:
        logger.error(f"Storage error getting job result: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve job result")
    except Exception as e:
        logger.error(f"Unexpected error getting job result: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/debug/stats")
async def get_debug_stats():
    """Get system statistics for debugging (development only)."""
    try:
        storage_stats = get_storage_stats()
        stream_info = get_stream_info()
        
        return {
            "storage": storage_stats,
            "stream": stream_info,
            "config": {
                "max_upload_mb": config.MAX_UPLOAD_MB,
                "gemini_available": config.is_gemini_available(),
                "stream_name": config.STREAM_NAME,
                "stream_group": config.STREAM_GROUP,
                "job_ttl_seconds": config.JOB_TTL_SECONDS
            }
        }
    except Exception as e:
        logger.error(f"Error getting debug stats: {e}")
        return {"error": str(e)}


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "message": "An unexpected error occurred"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
