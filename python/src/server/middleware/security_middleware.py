"""
Comprehensive Security Middleware for Archon Backend

Implements CORS, CSRF protection, security headers, and input sanitization
to protect against common web application vulnerabilities.
"""

import time
import secrets
import hashlib
from typing import Dict, List, Optional, Set
from urllib.parse import urlparse

from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from ..config.security_config import get_security_settings, validate_input, validate_url
from ..services.csrf_token_service import csrf_token_service

logger = logging.getLogger(__name__)

class SecurityMiddleware(BaseHTTPMiddleware):
    """Comprehensive security middleware for web application protection."""
    
    def __init__(self, app):
        super().__init__(app)
        self.security_settings = get_security_settings()
        
        # CSRF token service (database-backed for persistence)
        self.csrf_service = csrf_token_service
        
        # Content Security Policy
        self.csp_policy = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; "
            "img-src 'self' data: https:; "
            "connect-src 'self' ws: wss:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )
        
        # Security headers configuration
        self.security_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
            "Content-Security-Policy": self.csp_policy,
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
            "X-DNS-Prefetch-Control": "off",
            "X-Download-Options": "noopen",
            "X-Permitted-Cross-Domain-Policies": "none",
        }
        
        # Endpoints that require CSRF protection
        self.csrf_protected_endpoints = {
            "/api/projects",
            "/api/tasks",
            "/api/documents",
            "/api/auth/logout",
        }
        
        # Endpoints that are exempt from security checks
        self.exempt_endpoints = {
            "/health",
            "/api/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/auth/login",
            "/api/auth/register",
        }

    async def dispatch(self, request: Request, call_next):
        """Process request through security pipeline."""
        start_time = time.time()
        
        try:
            # Skip security checks for exempt endpoints
            if request.url.path in self.exempt_endpoints:
                response = await call_next(request)
                return self._add_security_headers(response)
            
            # Validate request method
            if not self._validate_http_method(request):
                return JSONResponse(
                    status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
                    content={"error": "HTTP method not allowed"}
                )
            
            # Validate content type for POST/PUT requests
            content_type_check = self._validate_content_type(request)
            if content_type_check:
                return content_type_check
            
            # Check CSRF protection for state-changing operations
            csrf_check = await self._check_csrf_protection(request)
            if csrf_check:
                return csrf_check
            
            # Validate and sanitize request headers
            headers_check = self._validate_headers(request)
            if headers_check:
                return headers_check
            
            # Check for suspicious patterns in URL
            url_check = self._validate_request_url(request)
            if url_check:
                return url_check
            
            # Process request
            response = await call_next(request)
            
            # Add security headers to response
            response = self._add_security_headers(response)
            
            # Add processing time
            process_time = time.time() - start_time
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
            
        except Exception as e:
            logger.error(f"Security middleware error: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"error": "Security validation failed"}
            )

    def _validate_http_method(self, request: Request) -> bool:
        """Validate HTTP method is allowed."""
        allowed_methods = {"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"}
        return request.method in allowed_methods

    def _validate_content_type(self, request: Request) -> Optional[JSONResponse]:
        """Validate content type for requests with bodies."""
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("content-type", "").lower()
            
            # Allow common content types
            allowed_types = {
                "application/json",
                "application/x-www-form-urlencoded", 
                "multipart/form-data",
                "text/plain",
            }
            
            # Check if content type is allowed (handle charset parameter)
            base_content_type = content_type.split(";")[0].strip()
            if base_content_type not in allowed_types:
                logger.warning(f"Invalid content type: {content_type}")
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content={"error": f"Unsupported content type: {base_content_type}"}
                )
        
        return None

    async def _check_csrf_protection(self, request: Request) -> Optional[JSONResponse]:
        """Check CSRF protection for state-changing operations."""
        if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            path = request.url.path
            
            # Check if endpoint requires CSRF protection
            requires_csrf = any(path.startswith(endpoint) for endpoint in self.csrf_protected_endpoints)
            
            if requires_csrf:
                # Skip CSRF for API requests with valid Authorization header
                auth_header = request.headers.get("Authorization")
                if auth_header and auth_header.startswith("Bearer "):
                    return None
                
                # Check for CSRF token in header
                csrf_token = request.headers.get("X-CSRF-Token")
                if not csrf_token:
                    logger.warning(f"Missing CSRF token for {path}")
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"error": "CSRF token required"}
                    )
                
                # Validate CSRF token using the service
                if not await self.csrf_service.validate_token(csrf_token):
                    logger.warning(f"Invalid CSRF token for {path}")
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"error": "Invalid CSRF token"}
                    )
        
        return None

    async def _validate_csrf_token(self, token: str, session_id: str = None) -> bool:
        """Validate CSRF token using the persistent service."""
        return await self.csrf_service.validate_token(token, session_id)

    def _validate_headers(self, request: Request) -> Optional[JSONResponse]:
        """Validate request headers for security issues."""
        # Check for suspicious headers
        suspicious_headers = {
            "x-forwarded-host",
            "x-original-host", 
            "x-rewrite-url",
        }
        
        for header in suspicious_headers:
            if header in request.headers:
                logger.warning(f"Suspicious header detected: {header}")
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"error": "Invalid request headers"}
                )
        
        # Validate User-Agent length
        user_agent = request.headers.get("user-agent", "")
        if len(user_agent) > 500:
            logger.warning(f"Overly long User-Agent: {len(user_agent)} characters")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": "Invalid User-Agent header"}
            )
        
        # Check for null bytes in headers
        for name, value in request.headers.items():
            if '\x00' in name or '\x00' in value:
                logger.warning(f"Null byte in header: {name}")
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"error": "Invalid header format"}
                )
        
        return None

    def _validate_request_url(self, request: Request) -> Optional[JSONResponse]:
        """Validate request URL for suspicious patterns."""
        path = request.url.path
        query = str(request.url.query) if request.url.query else ""
        
        # Check path length
        if len(path) > 2048:
            logger.warning(f"Overly long URL path: {len(path)} characters")
            return JSONResponse(
                status_code=status.HTTP_414_REQUEST_URI_TOO_LONG,
                content={"error": "URL path too long"}
            )
        
        # Check for directory traversal attempts
        traversal_patterns = ["../", "..\\", "%2e%2e%2f", "%2e%2e\\"]
        for pattern in traversal_patterns:
            if pattern in path.lower() or pattern in query.lower():
                logger.warning(f"Directory traversal attempt: {path}")
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"error": "Invalid URL path"}
                )
        
        # Check for common injection patterns
        injection_patterns = [
            "javascript:", "vbscript:", "data:", "file:",
            "<script", "</script>", "onerror=", "onclick=",
            "eval(", "alert(", "document.cookie"
        ]
        
        full_url = path + "?" + query if query else path
        for pattern in injection_patterns:
            if pattern in full_url.lower():
                logger.warning(f"Injection pattern detected in URL: {pattern}")
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"error": "Invalid URL format"}
                )
        
        return None

    def _add_security_headers(self, response: Response) -> Response:
        """Add security headers to response."""
        for header, value in self.security_headers.items():
            response.headers[header] = value
        
        # Add unique request ID for tracking
        if "X-Request-ID" not in response.headers:
            response.headers["X-Request-ID"] = secrets.token_hex(16)
        
        return response

    async def generate_csrf_token(self, session_id: str = None) -> str:
        """Generate a new CSRF token using the persistent service."""
        return await self.csrf_service.generate_token(session_id)

class InputSanitizationMiddleware(BaseHTTPMiddleware):
    """Middleware for input sanitization and validation."""
    
    def __init__(self, app):
        super().__init__(app)
        self.security_settings = get_security_settings()

    async def dispatch(self, request: Request, call_next):
        """Sanitize request inputs."""
        # Skip for GET requests and exempt endpoints
        if request.method == "GET" or request.url.path in {"/health", "/docs", "/redoc"}:
            return await call_next(request)
        
        try:
            # Validate query parameters
            for key, value in request.query_params.items():
                try:
                    validate_input(value, f"query parameter '{key}'")
                except HTTPException as e:
                    logger.warning(f"Invalid query parameter {key}: {value}")
                    return JSONResponse(
                        status_code=e.status_code,
                        content={"error": e.detail}
                    )
            
            # For JSON requests, we'll validate the body in the route handlers
            # as middleware can't easily modify the request body
            
            return await call_next(request)
            
        except Exception as e:
            logger.error(f"Input sanitization error: {e}")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": "Request validation failed"}
            )

def setup_security_middleware(app):
    """Setup security middleware for the FastAPI app."""
    app.add_middleware(InputSanitizationMiddleware)
    app.add_middleware(SecurityMiddleware)
    logger.info("Security middleware enabled")

# Helper functions for route handlers
def sanitize_json_input(data: dict, field_prefix: str = "") -> dict:
    """Sanitize JSON input data."""
    if not isinstance(data, dict):
        return data
    
    sanitized = {}
    for key, value in data.items():
        field_name = f"{field_prefix}.{key}" if field_prefix else key
        
        if isinstance(value, str):
            sanitized[key] = validate_input(value, field_name)
        elif isinstance(value, dict):
            sanitized[key] = sanitize_json_input(value, field_name)
        elif isinstance(value, list):
            sanitized[key] = [
                validate_input(item, f"{field_name}[{i}]") if isinstance(item, str)
                else sanitize_json_input(item, f"{field_name}[{i}]") if isinstance(item, dict)
                else item
                for i, item in enumerate(value)
            ]
        else:
            sanitized[key] = value
    
    return sanitized

# Export commonly used items
__all__ = [
    "SecurityMiddleware",
    "InputSanitizationMiddleware",
    "setup_security_middleware",
    "sanitize_json_input",
]
