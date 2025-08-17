"""
Security configuration for Archon backend.
Centralized security settings and authentication middleware.
"""

import os
from typing import List, Optional
from datetime import timedelta, datetime
import secrets
from functools import lru_cache

from pydantic import BaseModel, Field, validator
from fastapi import HTTPException, Security, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
import logging

logger = logging.getLogger(__name__)

# Security scheme for API documentation
security_scheme = HTTPBearer()

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class SecuritySettings(BaseModel):
    """Security configuration settings."""
    
    # CORS Settings
    allowed_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3737",
            "http://127.0.0.1:3737",
            "http://localhost:5173",  # Vite dev server
            "http://127.0.0.1:5173",
        ]
    )
    allow_credentials: bool = True
    allowed_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    allowed_headers: List[str] = ["*"]
    
    # JWT Settings
    secret_key: str = Field(default_factory=lambda: os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32)))
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    
    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 100  # requests per minute
    rate_limit_window: int = 60  # seconds
    
    # Security Headers
    enable_security_headers: bool = True
    csp_policy: str = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    
    # File Upload Security
    max_upload_size_mb: int = 10
    allowed_upload_extensions: List[str] = [".pdf", ".docx", ".txt", ".md", ".json", ".csv"]
    
    # Input Validation
    max_input_length: int = 10000
    sql_injection_patterns: List[str] = [
        "';", "--", "/*", "*/", "xp_", "sp_", "0x",
        "union", "select", "insert", "update", "delete", "drop",
        "exec", "execute", "script", "javascript:", "onclick"
    ]
    
    @validator("allowed_origins", pre=True)
    def parse_origins(cls, v):
        """Parse CORS origins from environment variable."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @validator("secret_key")
    def validate_secret_key(cls, v):
        """Ensure secret key is strong enough."""
        if len(v) < 32:
            raise ValueError("JWT secret key must be at least 32 characters")
        return v
    
    class Config:
        env_prefix = "SECURITY_"


@lru_cache()
def get_security_settings() -> SecuritySettings:
    """Get cached security settings."""
    # Load from environment
    allowed_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
    if allowed_origins_env:
        origins = [origin.strip() for origin in allowed_origins_env.split(",")]
    else:
        # Default to localhost for development
        origins = None

    # Enforce JWT secret policy
    dev_mode = os.getenv("DEV_MODE", "false").lower() == "true"
    jwt_secret = os.getenv("JWT_SECRET_KEY")

    if not jwt_secret and not dev_mode:
        # In production, require explicit JWT secret; avoid ephemeral secrets
        raise ValueError(
            "JWT_SECRET_KEY environment variable is required in production. "
            "Set DEV_MODE=true to allow a generated development-only secret."
        )

    # Get default allowed origins from a temporary instance (ensures valid defaults)
    default_allowed = SecuritySettings().allowed_origins

    return SecuritySettings(
        allowed_origins=origins if origins else default_allowed,
        secret_key=jwt_secret or secrets.token_urlsafe(32),
    )


class TokenData(BaseModel):
    """Token payload data."""
    sub: str  # Subject (user ID)
    exp: Optional[int] = None
    iat: Optional[int] = None
    scopes: List[str] = Field(default_factory=list)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    settings = get_security_settings()
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def verify_token(token: str) -> TokenData:
    """Verify and decode a JWT token."""
    settings = get_security_settings()
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return TokenData(**payload)
    except JWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security_scheme)) -> TokenData:
    """Dependency to get the current authenticated user from JWT token."""
    token = credentials.credentials
    return verify_token(token)


async def require_auth(current_user: TokenData = Depends(get_current_user)) -> TokenData:
    """Dependency that requires authentication for an endpoint."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return current_user

def require_admin(current_user: TokenData = Depends(get_current_user)) -> TokenData:
    """Dependency that requires admin privileges for an endpoint."""
    scopes = current_user.scopes or []
    if "admin" not in scopes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


def validate_input(input_str: str, field_name: str = "input") -> str:
    """
    Validate input to prevent SQL injection and XSS attacks.
    
    Args:
        input_str: The input string to validate
        field_name: Name of the field for error messages
        
    Returns:
        Sanitized input string
        
    Raises:
        HTTPException: If dangerous patterns are detected
    """
    settings = get_security_settings()
    
    if not input_str:
        return input_str
    
    # Check length
    if len(input_str) > settings.max_input_length:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{field_name} exceeds maximum length of {settings.max_input_length} characters"
        )
    
    # Check for SQL injection patterns
    lower_input = input_str.lower()
    for pattern in settings.sql_injection_patterns:
        if pattern in lower_input:
            logger.warning(f"Potential SQL injection attempt detected in {field_name}: {pattern}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid characters in {field_name}"
            )
    
    # Basic XSS prevention - escape HTML entities
    import html
    sanitized = html.escape(input_str)
    
    return sanitized


def validate_url(url: str) -> str:
    """
    Validate URL to prevent SSRF attacks.
    
    Args:
        url: URL to validate
        
    Returns:
        Validated URL
        
    Raises:
        HTTPException: If URL is invalid or potentially dangerous
    """
    from urllib.parse import urlparse
    import ipaddress
    import socket
    
    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid URL format"
        )
    
    # Check scheme
    if parsed.scheme not in ["http", "https"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only HTTP and HTTPS URLs are allowed"
        )
    
    # Check host
    if not parsed.hostname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL must have a valid hostname"
        )
    
    # Prevent local network access (SSRF protection)
    try:
        # Resolve hostname to IP
        ip = socket.gethostbyname(parsed.hostname)
        ip_obj = ipaddress.ip_address(ip)
        
        # Check if IP is private or loopback
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
            logger.warning(f"SSRF attempt blocked: {url} resolves to private IP {ip}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Access to private networks is not allowed"
            )
            
        # Block metadata endpoints
        metadata_ips = [
            "169.254.169.254",  # AWS/Azure/GCP metadata
            "100.100.100.200",  # Alibaba Cloud metadata
        ]
        if str(ip_obj) in metadata_ips:
            logger.warning(f"SSRF attempt to metadata endpoint blocked: {url}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Access to metadata endpoints is not allowed"
            )
            
    except socket.gaierror:
        # DNS resolution failed
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not resolve hostname"
        )
    except Exception as e:
        logger.error(f"URL validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL validation failed"
        )
    
    return url


def validate_file_upload(filename: str, content_type: str, file_size: int) -> None:
    """
    Validate file upload to prevent security issues.
    
    Args:
        filename: Name of uploaded file
        content_type: MIME type of file
        file_size: Size of file in bytes
        
    Raises:
        HTTPException: If file validation fails
    """
    settings = get_security_settings()
    
    # Check file size
    max_size_bytes = settings.max_upload_size_mb * 1024 * 1024
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum of {settings.max_upload_size_mb}MB"
        )
    
    # Check file extension
    import os
    _, ext = os.path.splitext(filename.lower())
    if ext not in settings.allowed_upload_extensions:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type {ext} not allowed. Allowed types: {', '.join(settings.allowed_upload_extensions)}"
        )
    
    # Validate content type matches extension
    content_type_map = {
        ".pdf": ["application/pdf"],
        ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        ".txt": ["text/plain"],
        ".md": ["text/markdown", "text/x-markdown", "text/plain"],
        ".json": ["application/json"],
        ".csv": ["text/csv", "application/csv"],
    }
    
    allowed_types = content_type_map.get(ext, [])
    if allowed_types and content_type not in allowed_types:
        logger.warning(f"Content type mismatch: {content_type} for extension {ext}")
        # Don't completely block, but log the mismatch
    
    # Check for double extensions
    if filename.count('.') > 1:
        # Could be attempt to bypass filters
        logger.warning(f"Multiple extensions detected in filename: {filename}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filenames with multiple extensions are not allowed"
        )


# Export commonly used items
__all__ = [
    "SecuritySettings",
    "get_security_settings",
    "create_access_token",
    "verify_token",
    "get_current_user",
    "require_auth",
    "require_admin",
    "validate_input",
    "validate_url",
    "validate_file_upload",
    "security_scheme",
    "pwd_context",
]