"""
Authentication middleware for Archon backend.
Implements JWT-based authentication with rate limiting and security headers.
"""

import time
from typing import Dict, Optional
from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
import logging

from ..config.security_config import get_security_settings, verify_token, TokenData

logger = logging.getLogger(__name__)

# Rate limiting storage (in production, use Redis)
rate_limit_storage: Dict[str, Dict[int, int]] = {}

class AuthenticationMiddleware(BaseHTTPMiddleware):
    """JWT Authentication middleware with optional endpoints."""
    
    def __init__(self, app: FastAPI):
        super().__init__(app)
        self.security_settings = get_security_settings()
        
        # Public endpoints that don't require authentication
        self.public_endpoints = {
            "/",
            "/health", 
            "/api/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/refresh",
        }
        
        # Endpoints that require authentication when auth is enabled
        self.protected_patterns = [
            "/api/projects",
            "/api/tasks", 
            "/api/knowledge",
            "/api/documents",
            "/api/mcp",
        ]

    async def dispatch(self, request: Request, call_next):
        """Process request through authentication pipeline."""
        start_time = time.time()
        
        try:
            # Add security headers
            response = await self._add_security_headers(request, call_next)
            
            # Add processing time header
            process_time = time.time() - start_time
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
            
        except Exception as e:
            logger.error(f"Authentication middleware error: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"error": "Authentication service error"}
            )

    async def _add_security_headers(self, request: Request, call_next):
        """Add security headers to response."""
        # Check rate limiting first
        if self.security_settings.rate_limit_enabled:
            rate_limit_check = self._check_rate_limit(request)
            if rate_limit_check:
                return rate_limit_check

        # Check authentication for protected endpoints
        auth_check = await self._check_authentication(request)
        if auth_check:
            return auth_check

        # Process request
        response = await call_next(request)
        
        # Add security headers
        if self.security_settings.enable_security_headers:
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            response.headers["Content-Security-Policy"] = self.security_settings.csp_policy
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        return response

    def _check_rate_limit(self, request: Request) -> Optional[JSONResponse]:
        """Check if request exceeds rate limits."""
        client_ip = self._get_client_ip(request)
        current_time = int(time.time())
        window_start = current_time - self.security_settings.rate_limit_window
        
        # Initialize storage for IP if not exists
        if client_ip not in rate_limit_storage:
            rate_limit_storage[client_ip] = {}
        
        # Clean old entries
        rate_limit_storage[client_ip] = {
            timestamp: count for timestamp, count in rate_limit_storage[client_ip].items()
            if int(timestamp) > window_start
        }
        
        # Count requests in current window
        total_requests = sum(rate_limit_storage[client_ip].values())
        
        if total_requests >= self.security_settings.rate_limit_requests:
            logger.warning(f"Rate limit exceeded for IP {client_ip}: {total_requests} requests")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "Rate limit exceeded",
                    "retry_after": self.security_settings.rate_limit_window
                },
                headers={"Retry-After": str(self.security_settings.rate_limit_window)}
            )
        
        # Record current request
        rate_limit_storage[client_ip][current_time] = rate_limit_storage[client_ip].get(current_time, 0) + 1
        
        return None

    async def _check_authentication(self, request: Request) -> Optional[JSONResponse]:
        """Check if request requires and has valid authentication."""
        path = request.url.path
        
        # Skip authentication for public endpoints
        if path in self.public_endpoints:
            return None
            
        # Skip authentication for static files and docs
        if any(path.startswith(prefix) for prefix in ["/static/", "/docs", "/redoc"]):
            return None
        
        # Check if path requires authentication
        requires_auth = any(path.startswith(pattern) for pattern in self.protected_patterns)
        
        if not requires_auth:
            return None
        
        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Missing Authorization header"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Invalid Authorization header format"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        try:
            # Verify JWT token
            token_data = verify_token(token)
            
            # Add user context to request state
            request.state.user = token_data
            request.state.authenticated = True
            
            logger.info(f"Authenticated request: {path} for user: {token_data.sub}")
            
        except HTTPException as e:
            logger.warning(f"Authentication failed for {path}: {e.detail}")
            return JSONResponse(
                status_code=e.status_code,
                content={"error": e.detail},
                headers={"WWW-Authenticate": "Bearer"}
            )
        except Exception as e:
            logger.error(f"Authentication error for {path}: {e}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Authentication failed"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        return None

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address considering proxy headers."""
        # Check for common proxy headers
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct connection
        if hasattr(request.client, "host"):
            return request.client.host
        
        return "unknown"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    
    def __init__(self, app: FastAPI):
        super().__init__(app)
        self.security_settings = get_security_settings()

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY" 
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = self.security_settings.csp_policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        return response


def setup_authentication_middleware(app: FastAPI, enable_auth: bool = True):
    """Setup authentication and security middleware for the FastAPI app."""
    
    if enable_auth:
        # Add authentication middleware
        app.add_middleware(AuthenticationMiddleware)
        logger.info("Authentication middleware enabled")
    else:
        logger.warning("Authentication middleware DISABLED - not suitable for production")
    
    # Always add security headers
    app.add_middleware(SecurityHeadersMiddleware)
    logger.info("Security headers middleware enabled")


# Helper function to get current user from request
def get_current_user_from_request(request: Request) -> Optional[TokenData]:
    """Get current authenticated user from request state."""
    if hasattr(request.state, "user"):
        return request.state.user
    return None


def require_authentication(request: Request) -> TokenData:
    """Require authentication and return user data or raise exception."""
    user = get_current_user_from_request(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    return user


# Export commonly used items
__all__ = [
    "AuthenticationMiddleware",
    "SecurityHeadersMiddleware", 
    "setup_authentication_middleware",
    "get_current_user_from_request",
    "require_authentication",
]