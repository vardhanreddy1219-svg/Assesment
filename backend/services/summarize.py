"""Document summarization service using Google Gemini."""

import logging
from typing import List, Dict, Any
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import config

logger = logging.getLogger(__name__)


class SummarizationError(Exception):
    """Custom exception for summarization errors."""
    pass


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
def _call_gemini_summarization_api(payload: Dict[str, Any]) -> str:
    """
    Make API call to Gemini for summarization with retry logic.
    
    Args:
        payload: Request payload for Gemini API
        
    Returns:
        Generated summary text
        
    Raises:
        SummarizationError: If API call fails
    """
    if not config.is_gemini_available():
        raise SummarizationError("Gemini API key not configured")
    
    url = f"{config.GEMINI_BASE_URL}/models/{config.GEMINI_MODEL_ID}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": config.GEMINI_API_KEY
    }
    
    try:
        with httpx.Client(timeout=config.GEMINI_TIMEOUT_SECONDS) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            
            # Extract text from Gemini response
            if "candidates" in result and len(result["candidates"]) > 0:
                candidate = result["candidates"][0]
                if "content" in candidate and "parts" in candidate["content"]:
                    parts = candidate["content"]["parts"]
                    if len(parts) > 0 and "text" in parts[0]:
                        return parts[0]["text"]
            
            raise SummarizationError("Invalid response format from Gemini API")
            
    except httpx.HTTPStatusError as e:
        error_msg = f"Gemini API HTTP error {e.response.status_code}: {e.response.text}"
        logger.error(error_msg)
        raise SummarizationError(error_msg)
    except httpx.TimeoutException:
        error_msg = "Gemini API request timed out"
        logger.error(error_msg)
        raise SummarizationError(error_msg)
    except Exception as e:
        error_msg = f"Gemini API call failed: {str(e)}"
        logger.error(error_msg)
        raise SummarizationError(error_msg)


def _prepare_content_for_summarization(pages_md: List[str], max_chars: int = 100000) -> str:
    """
    Prepare document content for summarization, with truncation if needed.
    
    Args:
        pages_md: List of markdown content per page
        max_chars: Maximum characters to include (to avoid context limits)
        
    Returns:
        Combined content string, potentially truncated
    """
    # Combine all pages
    full_content = "\n\n".join(pages_md)
    
    # Check if truncation is needed
    if len(full_content) <= max_chars:
        return full_content
    
    # Truncate and add disclaimer
    truncated_content = full_content[:max_chars]
    
    # Try to truncate at a reasonable boundary (end of sentence or paragraph)
    last_period = truncated_content.rfind('.')
    last_newline = truncated_content.rfind('\n')
    
    if last_period > max_chars * 0.9:  # If period is in last 10%, use it
        truncated_content = truncated_content[:last_period + 1]
    elif last_newline > max_chars * 0.9:  # Otherwise try newline
        truncated_content = truncated_content[:last_newline]
    
    # Add truncation notice
    truncated_content += "\n\n[NOTE: Document was truncated for summarization due to length]"
    
    logger.warning(f"Document truncated from {len(full_content)} to {len(truncated_content)} characters for summarization")
    
    return truncated_content


def summarize_markdown(pages_md: List[str]) -> str:
    """
    Summarize document content using Google Gemini 2.0 Flash.
    
    Args:
        pages_md: List of markdown content strings, one per page
        
    Returns:
        Summary in markdown format
    """
    if not config.is_gemini_available():
        logger.warning("Gemini API not available for summarization")
        return "**Summary unavailable**: Gemini API key not configured. Please set GEMINI_API_KEY environment variable to enable AI summarization."
    
    if not pages_md or all(not page.strip() for page in pages_md):
        return "**Summary unavailable**: No content found in document to summarize."
    
    try:
        logger.info(f"Generating summary for document with {len(pages_md)} pages")
        
        # Prepare content for summarization
        content = _prepare_content_for_summarization(pages_md)
        
        # Prepare Gemini API payload
        payload = {
            "contents": [{
                "parts": [{
                    "text": f"""Please provide a comprehensive summary of the following document. Your summary should:

1. Start with a brief overview paragraph (2-3 sentences)
2. Include key sections, topics, and main points as bullet points
3. Highlight important entities, numbers, dates, and findings
4. Capture the document's purpose and conclusions
5. Use clear, professional markdown formatting
6. Keep the summary concise but informative (aim for 200-500 words)

Document content:

{content}

Please provide only the summary in markdown format, without any additional commentary."""
                }]
            }]
        }
        
        # Call Gemini API
        summary = _call_gemini_summarization_api(payload)
        
        logger.info("Successfully generated document summary")
        return summary.strip()
        
    except SummarizationError as e:
        error_msg = f"**Summary unavailable**: {str(e)}"
        logger.error(f"Summarization failed: {e}")
        return error_msg
    except Exception as e:
        error_msg = f"**Summary unavailable**: Unexpected error during summarization - {str(e)}"
        logger.error(f"Unexpected summarization error: {e}")
        return error_msg


def summarize_document_pages(page_contents: List[Dict[str, Any]]) -> str:
    """
    Summarize document from page content dictionaries.
    
    Args:
        page_contents: List of dictionaries with 'page' and 'content_md' keys
        
    Returns:
        Summary in markdown format
    """
    # Extract markdown content from page dictionaries
    pages_md = [page.get("content_md", "") for page in page_contents]
    
    return summarize_markdown(pages_md)
