"""PDF utilities for file validation and processing."""

import os
import tempfile
import logging
from typing import List, Tuple, Optional
from pathlib import Path

from ..config import config

logger = logging.getLogger(__name__)

# PDF magic bytes for validation
PDF_MAGIC_BYTES = b'%PDF-'


def validate_pdf_file(file_content: bytes, filename: str) -> Tuple[bool, Optional[str]]:
    """
    Validate PDF file by checking magic bytes and size.
    
    Args:
        file_content: Raw file content
        filename: Original filename
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check file size
    if len(file_content) > config.MAX_UPLOAD_BYTES:
        size_mb = len(file_content) / (1024 * 1024)
        return False, f"File size ({size_mb:.1f}MB) exceeds maximum allowed size ({config.MAX_UPLOAD_MB}MB)"
    
    # Check minimum size (empty files)
    if len(file_content) < 10:
        return False, "File is too small to be a valid PDF"
    
    # Check PDF magic bytes
    if not file_content.startswith(PDF_MAGIC_BYTES):
        return False, "File is not a valid PDF (missing PDF header)"
    
    # Check file extension
    if not filename.lower().endswith('.pdf'):
        return False, "File must have a .pdf extension"
    
    return True, None


def save_temp_file(file_content: bytes, job_id: str) -> str:
    """
    Save uploaded file content to a temporary file.
    
    Args:
        file_content: Raw file content
        job_id: Unique job identifier
        
    Returns:
        Path to the temporary file
    """
    # Create temp file with job_id in name for easier debugging
    temp_path = os.path.join(tempfile.gettempdir(), f"{job_id}.pdf")
    
    try:
        with open(temp_path, 'wb') as f:
            f.write(file_content)
        
        logger.info(f"Saved temporary file: {temp_path} ({len(file_content)} bytes)")
        return temp_path
        
    except Exception as e:
        logger.error(f"Failed to save temporary file: {e}")
        raise


def text_to_markdown(text: str, page_num: int) -> str:
    """
    Convert plain text to simple markdown format.
    
    Args:
        text: Plain text content
        page_num: Page number (1-based)
        
    Returns:
        Markdown formatted text
    """
    if not text or not text.strip():
        return f"# Page {page_num}\n\n*No content found on this page*\n"
    
    # Clean up the text
    cleaned_text = text.strip()
    
    # Escape markdown special characters in the content
    # But preserve line breaks and basic formatting
    lines = cleaned_text.split('\n')
    processed_lines = []
    
    for line in lines:
        line = line.strip()
        if line:
            # Escape common markdown characters that might interfere
            line = line.replace('*', '\\*').replace('_', '\\_').replace('#', '\\#')
            processed_lines.append(line)
        else:
            processed_lines.append('')  # Preserve empty lines
    
    # Join lines and add page header
    content = '\n'.join(processed_lines)
    
    return f"# Page {page_num}\n\n{content}\n"


def pages_to_markdown_list(pages_text: List[str]) -> List[dict]:
    """
    Convert list of page texts to markdown format.
    
    Args:
        pages_text: List of plain text for each page
        
    Returns:
        List of dictionaries with page number and markdown content
    """
    result = []
    
    for i, text in enumerate(pages_text, 1):
        markdown_content = text_to_markdown(text, i)
        result.append({
            "page": i,
            "content_md": markdown_content
        })
    
    return result


def cleanup_temp_file(file_path: str) -> None:
    """
    Clean up temporary file if not configured to keep them.
    
    Args:
        file_path: Path to temporary file
    """
    if not config.KEEP_TMP_FILES:
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
                logger.debug(f"Cleaned up temporary file: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to clean up temporary file {file_path}: {e}")
    else:
        logger.debug(f"Keeping temporary file for debugging: {file_path}")


def get_file_info(file_path: str) -> dict:
    """
    Get basic file information.
    
    Args:
        file_path: Path to file
        
    Returns:
        Dictionary with file information
    """
    try:
        stat = os.stat(file_path)
        return {
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "exists": True,
            "path": file_path
        }
    except Exception as e:
        logger.error(f"Failed to get file info for {file_path}: {e}")
        return {
            "size_bytes": 0,
            "size_mb": 0,
            "exists": False,
            "path": file_path,
            "error": str(e)
        }
