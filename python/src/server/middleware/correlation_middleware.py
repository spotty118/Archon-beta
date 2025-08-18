"""
Correlation ID Middleware for FastAPI

Automatically injects correlation IDs into requests and responses for
distributed tracing across Archon microservices.
"""

import time
import uuid
from typing import Callable, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from src.server.logging.structured_logger import (
    set_correlation_id,
    set_user_context,
    set_request_context,
    get_logger,
    generate_correlation_id
)

logger = get_logger(__name__)

# Header names for correlation tracking
CORRELATION_ID_HEADER = "X-Correlation-ID"
REQUEST_ID_HEADER = "X-Request-ID"
USER_ID_HEADER = "X-User-ID"


class CorrelationMiddleware(BaseHTTPMiddleware):
    """Middleware to inject and track correlation IDs across requests"""
    
    def __init__(self, app, header_name: str = CORRELATION_ID_HEADER):
        super().__init__(app)
        self.header_name = header_name
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Process request with correlation ID injection"""
        start_time = time.time()
        
        # Extract or generate correlation ID
        correlation_id = self._extract_or_generate_correlation_id(request)
        
        # Extract user context if available
        user_id = request.headers.get(USER_ID_HEADER)
        
        # Set context variables for this request
        set_correlation_id(correlation_id)
        set_request_context(f"{request.method} {request.url.path}")
        
        if user_id:
            set_user_context(user_id)
        
        # Log request start
        logger.info(
            "Request started",
            http_method=request.method,
            http_path=str(request.url.path),
            http_query=str(request.url.query) if request.url.query else None,
            client_ip=self._get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            content_length=request.headers.get("content-length"),
            has_user_context=user_id is not None
        )
        
        try:
            # Process the request
            response = await call_next(request)
            
            # Calculate request duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Add correlation ID to response headers
            response.headers[self.header_name] = correlation_id
            response.headers[REQUEST_ID_HEADER] = correlation_id
            
            # Log successful request completion
            logger.api_request(
                method=request.method,
                path=str(request.url.path),
                status_code=response.status_code,
                duration_ms=duration_ms,
                response_size=response.headers.get("content-length"),
                cache_status=response.headers.get("X-Cache-Status")
            )
            
            return response
            
        except Exception as e:
            # Calculate request duration for failed requests
            duration_ms = (time.time() - start_time) * 1000
            
            # Log request failure
            logger.error(
                "Request failed",
                http_method=request.method,
                http_path=str(request.url.path),
                duration_ms=duration_ms,
                error=e
            )
            
            # Re-raise the exception to be handled by FastAPI
            raise
    
    def _extract_or_generate_correlation_id(self, request: Request) -> str:
        """Extract correlation ID from headers or generate new one"""
        
        # Try to get correlation ID from various possible headers
        correlation_id = (
            request.headers.get(self.header_name) or
            request.headers.get(REQUEST_ID_HEADER) or
            request.headers.get("X-Trace-ID") or
            request.headers.get("X-Request-Id")  # Alternative casing
        )
        
        if not correlation_id:
            correlation_id = generate_correlation_id()
            logger.debug(
                "Generated new correlation ID",
                generated_correlation_id=correlation_id
            )
        else:
            logger.debug(
                "Using existing correlation ID",
                existing_correlation_id=correlation_id,
                source_header=self._find_correlation_header(request)
            )
        
        return correlation_id
    
    def _find_correlation_header(self, request: Request) -> Optional[str]:
        """Find which header contained the correlation ID"""
        headers_to_check = [
            self.header_name,
            REQUEST_ID_HEADER,
            "X-Trace-ID",
            "X-Request-Id"
        ]
        
        for header in headers_to_check:
            if request.headers.get(header):
                return header
        
        return None
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address handling proxies"""
        
        # Check for forwarded headers (behind load balancer/proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain (original client)
            return forwarded_for.split(",")[0].strip()
        
        # Check for real IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct client IP
        if hasattr(request, "client") and request.client:
            return request.client.host
        
        return "unknown"


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """Middleware to add detailed timing headers to responses"""
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Add timing information to responses"""
        start_time = time.time()
        
        # Process the request
        response = await call_next(request)
        
        # Calculate timing
        total_time = time.time() - start_time
        
        # Add timing headers
        response.headers["X-Response-Time"] = f"{total_time:.3f}s"
        response.headers["X-Response-Time-Ms"] = f"{total_time * 1000:.1f}"
        
        return response


class SecurityAuditMiddleware(BaseHTTPMiddleware):
    """Middleware to log security-relevant events"""
    
    def __init__(self, app):
        super().__init__(app)
        self.sensitive_paths = {
            "/api/auth",
            "/api/login",
            "/api/settings",
            "/api/admin"
        }
        self.suspicious_patterns = [
            "sql",
            "script",
            "javascript:",
            "data:",
            "../",
            "..\\",
            "passwd",
            "shadow"
        ]
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Monitor for security events"""
        
        # Check for suspicious request patterns
        self._check_suspicious_patterns(request)
        
        # Log access to sensitive paths
        self._log_sensitive_access(request)
        
        # Process the request
        response = await call_next(request)
        
        # Log security events based on response
        self._log_security_response(request, response)
        
        return response
    
    def _check_suspicious_patterns(self, request: Request):
        """Check request for suspicious patterns"""
        url_path = str(request.url.path).lower()
        query_string = str(request.url.query).lower()
        
        # Check URL path and query for suspicious patterns
        for pattern in self.suspicious_patterns:
            if pattern in url_path or pattern in query_string:
                logger.security_event(
                    event_type="suspicious_request_pattern",
                    severity="medium",
                    details={
                        "pattern": pattern,
                        "path": str(request.url.path),
                        "query": str(request.url.query),
                        "user_agent": request.headers.get("user-agent"),
                        "client_ip": self._get_client_ip(request)
                    }
                )
                break
    
    def _log_sensitive_access(self, request: Request):
        """Log access to sensitive endpoints"""
        path = str(request.url.path)
        
        for sensitive_path in self.sensitive_paths:
            if path.startswith(sensitive_path):
                logger.security_event(
                    event_type="sensitive_endpoint_access",
                    severity="low",
                    details={
                        "endpoint": path,
                        "method": request.method,
                        "client_ip": self._get_client_ip(request),
                        "user_agent": request.headers.get("user-agent")
                    }
                )
                break
    
    def _log_security_response(self, request: Request, response: Response):
        """Log security events based on response status"""
        
        # Log authentication failures
        if response.status_code == 401:
            logger.security_event(
                event_type="authentication_failure",
                severity="medium",
                details={
                    "path": str(request.url.path),
                    "method": request.method,
                    "client_ip": self._get_client_ip(request),
                    "user_agent": request.headers.get("user-agent")
                }
            )
        
        # Log authorization failures
        elif response.status_code == 403:
            logger.security_event(
                event_type="authorization_failure",
                severity="medium",
                details={
                    "path": str(request.url.path),
                    "method": request.method,
                    "client_ip": self._get_client_ip(request)
                }
            )
        
        # Log potential attacks (multiple 4xx errors)
        elif 400 <= response.status_code < 500:
            logger.security_event(
                event_type="client_error",
                severity="low",
                details={
                    "status_code": response.status_code,
                    "path": str(request.url.path),
                    "method": request.method,
                    "client_ip": self._get_client_ip(request)
                }
            )
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address handling proxies"""
        # Same logic as CorrelationMiddleware
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        if hasattr(request, "client") and request.client:
            return request.client.host
        
        return "unknown"


# Convenience function to add all correlation middleware
def add_correlation_middleware(app):
    """Add all correlation and security middleware to FastAPI app"""
    
    # Add in reverse order (they execute in reverse order)
    app.add_middleware(SecurityAuditMiddleware)
    app.add_middleware(RequestTimingMiddleware)
    app.add_middleware(CorrelationMiddleware)
    
    logger.info("Correlation middleware added to FastAPI application")


__all__ = [
    'CorrelationMiddleware',
    'RequestTimingMiddleware', 
    'SecurityAuditMiddleware',
    'add_correlation_middleware',
    'CORRELATION_ID_HEADER',
    'REQUEST_ID_HEADER',
    'USER_ID_HEADER'
]
