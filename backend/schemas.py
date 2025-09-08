"""Pydantic schemas for the document processing service."""

from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field


class ParserChoice(str, Enum):
    """Available parser options."""
    PYPDF = "pypdf"
    GEMINI = "gemini"
    MISTRAL = "mistral"


class JobStatus(str, Enum):
    """Job status options."""
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"


class UploadResponse(BaseModel):
    """Response for file upload."""
    job_id: str = Field(..., description="Unique job identifier")
    message: str = Field(default="File uploaded successfully", description="Success message")


class StatusResponse(BaseModel):
    """Response for job status check."""
    job_id: str = Field(..., description="Job identifier")
    status: JobStatus = Field(..., description="Current job status")
    parser: Optional[str] = Field(None, description="Parser used for processing")
    page_count: Optional[int] = Field(None, description="Number of pages in document")
    error_message: Optional[str] = Field(None, description="Error message if status is error")
    created_at: Optional[str] = Field(None, description="Job creation timestamp")
    updated_at: Optional[str] = Field(None, description="Last update timestamp")


class PageContent(BaseModel):
    """Content for a single page."""
    page: int = Field(..., description="Page number (1-based)")
    content_md: str = Field(..., description="Page content in markdown format")


class ResultResponse(BaseModel):
    """Response for job results."""
    job_id: str = Field(..., description="Job identifier")
    parser: str = Field(..., description="Parser used for processing")
    per_page_markdown: List[PageContent] = Field(..., description="Markdown content per page")
    summary_md: str = Field(..., description="Document summary in markdown")
    page_count: int = Field(..., description="Total number of pages")


class ErrorResponse(BaseModel):
    """Error response schema."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    job_id: Optional[str] = Field(None, description="Job ID if applicable")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Service status")
    timestamp: str = Field(..., description="Current timestamp")
    redis_connected: bool = Field(..., description="Redis connection status")
    gemini_available: bool = Field(..., description="Gemini API availability")


class StreamInfoResponse(BaseModel):
    """Redis stream information response."""
    stream_name: str = Field(..., description="Stream name")
    stream_info: Dict[str, Any] = Field(..., description="Stream information")
    group_info: List[Dict[str, Any]] = Field(..., description="Consumer group information")


# Request schemas for validation
class UploadRequest(BaseModel):
    """Upload request validation."""
    parser: ParserChoice = Field(default=ParserChoice.PYPDF, description="Parser to use")


# Internal schemas for job processing
class JobData(BaseModel):
    """Internal job data structure."""
    job_id: str
    parser: ParserChoice
    filename: str
    file_path: str
    created_at: str


class ProcessingResult(BaseModel):
    """Result from document processing."""
    parser: str
    per_page_markdown: List[PageContent]
    summary_md: str
    page_count: int
