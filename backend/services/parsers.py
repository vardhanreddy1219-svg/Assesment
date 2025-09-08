"""Document parsing services for different parser backends."""

import base64
import logging
import re
from typing import List, Dict, Any
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from pypdf import PdfReader

from ..config import config
from ..utils.pdf_utils import pages_to_markdown_list

logger = logging.getLogger(__name__)


class ParsingError(Exception):
    """Custom exception for parsing errors."""
    pass


def parse_with_pypdf(file_path: str) -> List[str]:
    """
    Parse PDF using pypdf library to extract plain text per page.
    
    Args:
        file_path: Path to PDF file
        
    Returns:
        List of plain text strings, one per page
        
    Raises:
        ParsingError: If parsing fails
    """
    try:
        logger.info(f"Parsing PDF with pypdf: {file_path}")
        
        reader = PdfReader(file_path)
        pages_text = []
        
        for i, page in enumerate(reader.pages, 1):
            try:
                text = page.extract_text()
                pages_text.append(text or "")
                logger.debug(f"Extracted {len(text or '')} characters from page {i}")
            except Exception as e:
                logger.warning(f"Failed to extract text from page {i}: {e}")
                pages_text.append(f"Error extracting text from page {i}: {str(e)}")
        
        logger.info(f"Successfully parsed {len(pages_text)} pages with pypdf")
        return pages_text
        
    except Exception as e:
        error_msg = f"pypdf parsing failed: {str(e)}"
        logger.error(error_msg)
        raise ParsingError(error_msg)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
def _call_gemini_api(payload: Dict[str, Any]) -> str:
    """
    Make API call to Gemini with retry logic.
    
    Args:
        payload: Request payload for Gemini API
        
    Returns:
        Generated text response
        
    Raises:
        ParsingError: If API call fails
    """
    if not config.is_gemini_available():
        raise ParsingError("Gemini API key not configured")
    
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
            
            raise ParsingError("Invalid response format from Gemini API")
            
    except httpx.HTTPStatusError as e:
        error_msg = f"Gemini API HTTP error {e.response.status_code}: {e.response.text}"
        logger.error(error_msg)
        raise ParsingError(error_msg)
    except httpx.TimeoutException:
        error_msg = "Gemini API request timed out"
        logger.error(error_msg)
        raise ParsingError(error_msg)
    except Exception as e:
        error_msg = f"Gemini API call failed: {str(e)}"
        logger.error(error_msg)
        raise ParsingError(error_msg)


def parse_with_gemini(file_path: str) -> List[str]:
    """
    Parse PDF using Google Gemini 2.0 Flash to extract markdown per page.
    
    Args:
        file_path: Path to PDF file
        
    Returns:
        List of markdown strings, one per page
        
    Raises:
        ParsingError: If parsing fails
    """
    if not config.is_gemini_available():
        logger.warning("Gemini API not available, falling back to pypdf")
        return parse_with_pypdf(file_path)
    
    try:
        logger.info(f"Parsing PDF with Gemini: {file_path}")
        
        # Read and encode PDF file
        with open(file_path, 'rb') as f:
            pdf_data = f.read()
        
        pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')
        
        # Prepare Gemini API payload
        payload = {
            "contents": [{
                "parts": [
                    {
                        "text": """You are a PDF-to-Markdown parser. Extract the content from this PDF and convert it to markdown format.

IMPORTANT INSTRUCTIONS:
1. Process each page separately and clearly mark page boundaries
2. Use the exact format: "# Page N" (where N is the page number) as a header for each page
3. Preserve the document structure using appropriate markdown formatting
4. Convert tables to markdown table format when possible
5. Preserve headings, lists, and other formatting elements
6. If a page has no readable content, indicate this clearly
7. Do not add any commentary or explanations - just return the formatted content

Please process this PDF and return the markdown content with clear page separations."""
                    },
                    {
                        "inlineData": {
                            "mimeType": "application/pdf",
                            "data": pdf_base64
                        }
                    }
                ]
            }]
        }
        
        # Call Gemini API
        markdown_text = _call_gemini_api(payload)
        
        # Split response into pages
        pages_markdown = _split_gemini_response_by_pages(markdown_text)
        
        logger.info(f"Successfully parsed {len(pages_markdown)} pages with Gemini")
        return pages_markdown
        
    except ParsingError:
        # Re-raise parsing errors
        raise
    except Exception as e:
        error_msg = f"Gemini parsing failed: {str(e)}"
        logger.error(error_msg)
        
        # Fallback to pypdf if Gemini fails
        logger.info("Falling back to pypdf due to Gemini error")
        try:
            return parse_with_pypdf(file_path)
        except Exception as fallback_error:
            raise ParsingError(f"Both Gemini and pypdf parsing failed. Gemini: {error_msg}, pypdf: {str(fallback_error)}")


def _split_gemini_response_by_pages(markdown_text: str) -> List[str]:
    """
    Split Gemini response into individual pages based on page markers.
    
    Args:
        markdown_text: Full markdown text from Gemini
        
    Returns:
        List of markdown strings, one per page
    """
    # Look for page markers like "# Page 1", "# Page 2", etc.
    page_pattern = r'^# Page\s+(\d+)\s*$'
    
    # Split by page markers
    pages = re.split(page_pattern, markdown_text, flags=re.MULTILINE)
    
    if len(pages) <= 1:
        # No page markers found, treat as single page
        logger.warning("No page markers found in Gemini response, treating as single page")
        return [markdown_text.strip()]
    
    result = []
    
    # Process split results (alternates between page numbers and content)
    for i in range(1, len(pages), 2):
        if i + 1 < len(pages):
            page_num = pages[i]
            content = pages[i + 1].strip()
            
            # Reconstruct page with header
            page_markdown = f"# Page {page_num}\n\n{content}"
            result.append(page_markdown)
    
    # If we didn't get any pages from splitting, return the original text
    if not result:
        logger.warning("Failed to split Gemini response by pages, returning as single page")
        return [markdown_text.strip()]
    
    return result


def parse_with_mistral(file_path: str) -> List[str]:
    """
    Parse PDF using Mistral (stubbed implementation).
    
    Args:
        file_path: Path to PDF file
        
    Returns:
        List of markdown strings, one per page
        
    Raises:
        NotImplementedError: Always, as this is a stub
    """
    raise NotImplementedError(
        "Mistral parser is not yet implemented. This is a placeholder for future development. "
        "Please use 'pypdf' or 'gemini' parsers instead."
    )


def parse_document(file_path: str, parser: str) -> List[dict]:
    """
    Parse document using the specified parser.
    
    Args:
        file_path: Path to PDF file
        parser: Parser to use ('pypdf', 'gemini', 'mistral')
        
    Returns:
        List of dictionaries with page number and markdown content
        
    Raises:
        ParsingError: If parsing fails
        NotImplementedError: If parser is not implemented
    """
    logger.info(f"Parsing document with {parser} parser: {file_path}")
    
    if parser == "pypdf":
        pages_text = parse_with_pypdf(file_path)
        return pages_to_markdown_list(pages_text)
    elif parser == "gemini":
        pages_markdown = parse_with_gemini(file_path)
        # Gemini already returns markdown, so we need to format it properly
        result = []
        for i, content in enumerate(pages_markdown, 1):
            result.append({
                "page": i,
                "content_md": content
            })
        return result
    elif parser == "mistral":
        parse_with_mistral(file_path)  # Will raise NotImplementedError
    else:
        raise ParsingError(f"Unknown parser: {parser}")
