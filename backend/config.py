"""Configuration management for the document processing service."""

import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Application configuration with environment variable support."""
    
    # Redis Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    
    # Stream Configuration
    STREAM_NAME: str = os.getenv("STREAM_NAME", "pdf_jobs")
    STREAM_GROUP: str = os.getenv("STREAM_GROUP", "pdf_group")
    
    # Gemini Configuration
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL_ID: str = os.getenv("GEMINI_MODEL_ID", "gemini-2.0-flash")
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta"
    
    # File Upload Configuration
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "25"))
    MAX_UPLOAD_BYTES: int = MAX_UPLOAD_MB * 1024 * 1024
    
    # Temporary File Configuration
    KEEP_TMP_FILES: bool = os.getenv("KEEP_TMP_FILES", "false").lower() in ("true", "1", "yes")
    
    # Job Configuration
    JOB_TTL_SECONDS: int = int(os.getenv("JOB_TTL_SECONDS", "86400"))  # 24 hours
    
    # Worker Configuration
    WORKER_TIMEOUT_SECONDS: int = int(os.getenv("WORKER_TIMEOUT_SECONDS", "300"))  # 5 minutes
    GEMINI_TIMEOUT_SECONDS: int = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "120"))  # 2 minutes
    
    # Logging Configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    @classmethod
    def validate(cls) -> None:
        """Validate required configuration."""
        if not cls.GEMINI_API_KEY:
            print("WARNING: GEMINI_API_KEY not set. Gemini parsing and summarization will be disabled.")
    
    @classmethod
    def is_gemini_available(cls) -> bool:
        """Check if Gemini API is available."""
        return cls.GEMINI_API_KEY is not None and len(cls.GEMINI_API_KEY.strip()) > 0


# Global config instance
config = Config()

# Validate configuration on import
config.validate()
