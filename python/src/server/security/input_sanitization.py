"""
Input Sanitization Module

Comprehensive input validation and sanitization to prevent XSS, SQL injection,
and other injection attacks across all API endpoints.
"""

import re
import html
import urllib.parse
from typing import Any, Dict, List, Union, Optional
from ..config.logfire_config import get_logger

logger = get_logger(__name__)

class InputSanitizer:
    """Comprehensive input sanitization with configurable policies"""
    
    # Dangerous patterns that should be blocked
    XSS_PATTERNS = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'vbscript:',
        r'onload\s*=',
        r'onerror\s*=',
        r'onclick\s*=',
        r'onmouseover\s*=',
        r'onfocus\s*=',
        r'onblur\s*=',
        r'eval\s*\(',
        r'expression\s*\(',
        r'url\s*\(',
        r'@import',
        r'<iframe[^>]*>',
        r'<object[^>]*>',
        r'<embed[^>]*>',
        r'<applet[^>]*>',
        r'<meta[^>]*>',
        r'<link[^>]*>',
        r'<style[^>]*>.*?</style>',
    ]
    
    SQL_INJECTION_PATTERNS = [
        r'\bunion\b.*\bselect\b',
        r'\bselect\b.*\bfrom\b',
        r'\binsert\b.*\binto\b',
        r'\bdelete\b.*\bfrom\b',
        r'\bdrop\b.*\btable\b',
        r'\bupdate\b.*\bset\b',
        r'\balter\b.*\btable\b',
        r'\bcreate\b.*\btable\b',
        r'\bexec\b.*\(',
        r'\bexecute\b.*\(',
        r'--',
        r'/\*.*\*/',
        r';\s*drop\s',
        r';\s*delete\s',
        r';\s*insert\s',
        r';\s*update\s',
    ]
    
    # Command injection patterns
    COMMAND_INJECTION_PATTERNS = [
        r';\s*cat\s',
        r';\s*ls\s',
        r';\s*pwd\s',
        r';\s*whoami\s',
        r';\s*id\s',
        r';\s*ps\s',
        r';\s*kill\s',
        r';\s*rm\s',
        r';\s*mv\s',
        r';\s*cp\s',
        r';\s*chmod\s',
        r';\s*chown\s',
        r'\$\(',
        r'`[^`]*`',
        r'\|\s*nc\s',
        r'\|\s*netcat\s',
        r'\|\s*wget\s',
        r'\|\s*curl\s',
    ]
    
    def __init__(self, strict_mode: bool = True):
        self.strict_mode = strict_mode
        self.compiled_xss_patterns = [re.compile(pattern, re.IGNORECASE | re.DOTALL) 
                                     for pattern in self.XSS_PATTERNS]
        self.compiled_sql_patterns = [re.compile(pattern, re.IGNORECASE) 
                                     for pattern in self.SQL_INJECTION_PATTERNS]
        self.compiled_cmd_patterns = [re.compile(pattern, re.IGNORECASE) 
                                     for pattern in self.COMMAND_INJECTION_PATTERNS]
    
    def sanitize_string(self, value: str, max_length: int = 10000) -> str:
        """Sanitize a string input"""
        if not isinstance(value, str):
            return str(value)
        
        # Length validation
        if len(value) > max_length:
            logger.warning(f"Input truncated: length {len(value)} > {max_length}")
            value = value[:max_length]
        
        # HTML encode dangerous characters
        value = html.escape(value, quote=True)
        
        # Remove null bytes
        value = value.replace('\x00', '')
        
        # Check for XSS patterns
        for pattern in self.compiled_xss_patterns:
            if pattern.search(value):
                if self.strict_mode:
                    raise ValueError(f"Potential XSS attack detected in input")
                else:
                    value = pattern.sub('', value)
                    logger.warning("XSS pattern removed from input")
        
        # Check for SQL injection patterns
        for pattern in self.compiled_sql_patterns:
            if pattern.search(value):
                if self.strict_mode:
                    raise ValueError(f"Potential SQL injection detected in input")
                else:
                    value = pattern.sub('', value)
                    logger.warning("SQL injection pattern removed from input")
        
        # Check for command injection patterns
        for pattern in self.compiled_cmd_patterns:
            if pattern.search(value):
                if self.strict_mode:
                    raise ValueError(f"Potential command injection detected in input")
                else:
                    value = pattern.sub('', value)
                    logger.warning("Command injection pattern removed from input")
        
        return value.strip()
    
    def sanitize_url(self, url: str) -> str:
        """Sanitize URL input"""
        if not url:
            return ""
        
        # Parse and validate URL
        try:
            parsed = urllib.parse.urlparse(url)
            
            # Only allow HTTP/HTTPS
            if parsed.scheme not in ['http', 'https']:
                raise ValueError(f"Invalid URL scheme: {parsed.scheme}")
            
            # Prevent localhost/private network access
            if parsed.hostname:
                hostname = parsed.hostname.lower()
                if (hostname in ['localhost', '127.0.0.1', '::1'] or
                    hostname.startswith('192.168.') or
                    hostname.startswith('10.') or
                    hostname.startswith('172.16.') or
                    hostname.startswith('169.254.')):
                    raise ValueError("Access to private networks not allowed")
            
            # Reconstruct clean URL
            return urllib.parse.urlunparse(parsed)
        
        except Exception as e:
            logger.error(f"URL sanitization failed: {e}")
            raise ValueError(f"Invalid URL: {url}")
    
    def sanitize_email(self, email: str) -> str:
        """Sanitize email input"""
        if not email:
            return ""
        
        # Basic email pattern
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise ValueError(f"Invalid email format: {email}")
        
        return email.lower().strip()
    
    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename input"""
        if not filename:
            return ""
        
        # Remove path traversal attempts
        filename = filename.replace('..', '').replace('/', '').replace('\\', '')
        
        # Remove dangerous characters
        filename = re.sub(r'[<>:"|?*\x00-\x1f]', '', filename)
        
        # Limit length
        if len(filename) > 255:
            filename = filename[:255]
        
        return filename.strip()
    
    def sanitize_dict(self, data: Dict[str, Any], max_depth: int = 10) -> Dict[str, Any]:
        """Recursively sanitize dictionary data"""
        if max_depth <= 0:
            raise ValueError("Maximum recursion depth exceeded")
        
        sanitized = {}
        for key, value in data.items():
            # Sanitize key
            clean_key = self.sanitize_string(str(key), max_length=100)
            
            # Sanitize value based on type
            if isinstance(value, str):
                sanitized[clean_key] = self.sanitize_string(value)
            elif isinstance(value, dict):
                sanitized[clean_key] = self.sanitize_dict(value, max_depth - 1)
            elif isinstance(value, list):
                sanitized[clean_key] = self.sanitize_list(value, max_depth - 1)
            elif isinstance(value, (int, float, bool)) or value is None:
                sanitized[clean_key] = value
            else:
                # Convert unknown types to string and sanitize
                sanitized[clean_key] = self.sanitize_string(str(value))
        
        return sanitized
    
    def sanitize_list(self, data: List[Any], max_depth: int = 10) -> List[Any]:
        """Recursively sanitize list data"""
        if max_depth <= 0:
            raise ValueError("Maximum recursion depth exceeded")
        
        sanitized = []
        for item in data:
            if isinstance(item, str):
                sanitized.append(self.sanitize_string(item))
            elif isinstance(item, dict):
                sanitized.append(self.sanitize_dict(item, max_depth - 1))
            elif isinstance(item, list):
                sanitized.append(self.sanitize_list(item, max_depth - 1))
            elif isinstance(item, (int, float, bool)) or item is None:
                sanitized.append(item)
            else:
                sanitized.append(self.sanitize_string(str(item)))
        
        return sanitized
    
    def validate_json_size(self, data: Union[Dict, List], max_size: int = 1024 * 1024) -> bool:
        """Validate JSON data size to prevent DoS attacks"""
        import json
        try:
            serialized = json.dumps(data)
            if len(serialized) > max_size:
                raise ValueError(f"JSON data too large: {len(serialized)} > {max_size}")
            return True
        except Exception as e:
            logger.error(f"JSON size validation failed: {e}")
            return False

# Global sanitizer instance
sanitizer = InputSanitizer(strict_mode=True)

def sanitize_input(value: Any, input_type: str = "string") -> Any:
    """Main sanitization function"""
    try:
        if input_type == "string":
            return sanitizer.sanitize_string(str(value))
        elif input_type == "url":
            return sanitizer.sanitize_url(str(value))
        elif input_type == "email":
            return sanitizer.sanitize_email(str(value))
        elif input_type == "filename":
            return sanitizer.sanitize_filename(str(value))
        elif input_type == "dict":
            return sanitizer.sanitize_dict(value)
        elif input_type == "list":
            return sanitizer.sanitize_list(value)
        else:
            return sanitizer.sanitize_string(str(value))
    except Exception as e:
        logger.error(f"Input sanitization failed: {e}")
        raise ValueError(f"Invalid input: {str(e)}")

def validate_request_size(content_length: Optional[int], max_size: int = 10 * 1024 * 1024) -> bool:
    """Validate request size to prevent DoS attacks"""
    if content_length and content_length > max_size:
        raise ValueError(f"Request too large: {content_length} > {max_size}")
    return True