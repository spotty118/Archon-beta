"""
Authentication and Authorization Data Models

Defines Pydantic models for authentication, user management,
and authorization with comprehensive validation and security.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Union
from enum import Enum

from pydantic import BaseModel, Field, EmailStr, validator, root_validator
from passlib.context import CryptContext
import secrets

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserRole(str, Enum):
    """User roles for authorization."""
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"
    GUEST = "guest"

class PermissionScope(str, Enum):
    """Permission scopes for fine-grained access control."""
    # Project permissions
    PROJECT_READ = "project:read"
    PROJECT_WRITE = "project:write"
    PROJECT_DELETE = "project:delete"
    PROJECT_ADMIN = "project:admin"
    
    # Knowledge permissions
    KNOWLEDGE_READ = "knowledge:read"
    KNOWLEDGE_WRITE = "knowledge:write"
    KNOWLEDGE_DELETE = "knowledge:delete"
    KNOWLEDGE_UPLOAD = "knowledge:upload"
    
    # Task permissions
    TASK_READ = "task:read"
    TASK_WRITE = "task:write"
    TASK_DELETE = "task:delete"
    TASK_EXECUTE = "task:execute"
    
    # MCP permissions
    MCP_READ = "mcp:read"
    MCP_WRITE = "mcp:write"
    MCP_ADMIN = "mcp:admin"
    
    # System permissions
    SYSTEM_ADMIN = "system:admin"
    SYSTEM_CONFIG = "system:config"
    SYSTEM_MONITOR = "system:monitor"
    
    # User management
    USER_READ = "user:read"
    USER_WRITE = "user:write"
    USER_DELETE = "user:delete"

class AuthProvider(str, Enum):
    """Authentication providers."""
    LOCAL = "local"
    OAUTH_GOOGLE = "oauth_google"
    OAUTH_GITHUB = "oauth_github"
    OAUTH_MICROSOFT = "oauth_microsoft"
    SAML = "saml"

class SessionStatus(str, Enum):
    """Session status enumeration."""
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    SUSPENDED = "suspended"

# Core Authentication Models

class UserBase(BaseModel):
    """Base user model with common fields."""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, regex=r"^[a-zA-Z0-9_-]+$")
    full_name: Optional[str] = Field(None, max_length=100)
    is_active: bool = True
    role: UserRole = UserRole.USER
    auth_provider: AuthProvider = AuthProvider.LOCAL
    
    @validator("username")
    def validate_username(cls, v):
        """Validate username format."""
        if v.lower() in ["admin", "root", "system", "api", "null", "undefined"]:
            raise ValueError("Username not allowed")
        return v.lower()

class UserCreate(UserBase):
    """User creation model with password."""
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str
    permissions: List[PermissionScope] = Field(default_factory=list)
    
    @validator("password")
    def validate_password(cls, v):
        """Validate password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        
        # Check for required character types
        has_upper = any(c.isupper() for c in v)
        has_lower = any(c.islower() for c in v)
        has_digit = any(c.isdigit() for c in v)
        has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in v)
        
        if not all([has_upper, has_lower, has_digit, has_special]):
            raise ValueError(
                "Password must contain at least one uppercase letter, "
                "lowercase letter, digit, and special character"
            )
        
        # Check for common weak patterns
        weak_patterns = ["password", "123456", "qwerty", "admin"]
        if any(pattern in v.lower() for pattern in weak_patterns):
            raise ValueError("Password contains common weak patterns")
        
        return v
    
    @root_validator
    def validate_passwords_match(cls, values):
        """Validate that passwords match."""
        password = values.get("password")
        confirm_password = values.get("confirm_password")
        
        if password and confirm_password and password != confirm_password:
            raise ValueError("Passwords do not match")
        
        return values

class UserUpdate(BaseModel):
    """User update model."""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None
    permissions: Optional[List[PermissionScope]] = None

class UserInDB(UserBase):
    """User model as stored in database."""
    id: str
    hashed_password: str
    permissions: List[PermissionScope] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None
    password_changed_at: datetime
    must_change_password: bool = False
    
    class Config:
        orm_mode = True

class UserResponse(UserBase):
    """User response model (without sensitive data)."""
    id: str
    permissions: List[PermissionScope]
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None
    must_change_password: bool = False
    
    class Config:
        orm_mode = True

# Authentication Models

class LoginRequest(BaseModel):
    """Login request model."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)
    remember_me: bool = False
    
    @validator("username")
    def normalize_username(cls, v):
        """Normalize username to lowercase."""
        return v.lower().strip()

class TokenData(BaseModel):
    """JWT token payload data."""
    sub: str  # Subject (user ID)
    username: str
    email: str
    role: UserRole
    permissions: List[PermissionScope]
    exp: int  # Expiration timestamp
    iat: int  # Issued at timestamp
    jti: str  # JWT ID for token revocation
    session_id: str  # Session identifier
    
    class Config:
        use_enum_values = True

class TokenResponse(BaseModel):
    """Token response model."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # Seconds until expiration
    expires_at: datetime
    permissions: List[PermissionScope]
    
    class Config:
        use_enum_values = True

class RefreshTokenRequest(BaseModel):
    """Refresh token request model."""
    refresh_token: str

class PasswordChangeRequest(BaseModel):
    """Password change request model."""
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str
    
    @validator("new_password")
    def validate_new_password(cls, v):
        """Validate new password strength."""
        return UserCreate.validate_password(v)
    
    @root_validator
    def validate_passwords_match(cls, values):
        """Validate that new passwords match."""
        new_password = values.get("new_password")
        confirm_password = values.get("confirm_password")
        
        if new_password and confirm_password and new_password != confirm_password:
            raise ValueError("New passwords do not match")
        
        return values

class PasswordResetRequest(BaseModel):
    """Password reset request model."""
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    """Password reset confirmation model."""
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str
    
    @validator("new_password")
    def validate_new_password(cls, v):
        """Validate new password strength."""
        return UserCreate.validate_password(v)
    
    @root_validator
    def validate_passwords_match(cls, values):
        """Validate that passwords match."""
        new_password = values.get("new_password")
        confirm_password = values.get("confirm_password")
        
        if new_password and confirm_password and new_password != confirm_password:
            raise ValueError("Passwords do not match")
        
        return values

# Session Management Models

class SessionCreate(BaseModel):
    """Session creation model."""
    user_id: str
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    expires_at: datetime

class SessionInDB(SessionCreate):
    """Session model as stored in database."""
    id: str
    jti: str  # JWT ID
    status: SessionStatus = SessionStatus.ACTIVE
    created_at: datetime
    last_activity: datetime
    
    class Config:
        orm_mode = True

class SessionResponse(BaseModel):
    """Session response model."""
    id: str
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    last_activity: datetime
    expires_at: datetime
    status: SessionStatus
    is_current: bool = False
    
    class Config:
        orm_mode = True
        use_enum_values = True

# Authorization Models

class PermissionCheck(BaseModel):
    """Permission check request model."""
    user_id: str
    resource: str  # e.g., "project:123", "knowledge:456"
    action: PermissionScope

class AuthorizationContext(BaseModel):
    """Authorization context for requests."""
    user_id: str
    username: str
    role: UserRole
    permissions: List[PermissionScope]
    session_id: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    
    def has_permission(self, permission: PermissionScope) -> bool:
        """Check if user has specific permission."""
        return permission in self.permissions or self.role == UserRole.ADMIN
    
    def has_any_permission(self, permissions: List[PermissionScope]) -> bool:
        """Check if user has any of the specified permissions."""
        return any(self.has_permission(perm) for perm in permissions)
    
    def has_all_permissions(self, permissions: List[PermissionScope]) -> bool:
        """Check if user has all of the specified permissions."""
        return all(self.has_permission(perm) for perm in permissions)
    
    class Config:
        use_enum_values = True

# API Key Models

class APIKeyCreate(BaseModel):
    """API key creation model."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    permissions: List[PermissionScope] = Field(default_factory=list)
    expires_at: Optional[datetime] = None
    
    @validator("expires_at")
    def validate_expiration(cls, v):
        """Validate expiration date is in the future."""
        if v and v <= datetime.utcnow():
            raise ValueError("Expiration date must be in the future")
        return v

class APIKeyInDB(BaseModel):
    """API key model as stored in database."""
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    key_hash: str  # Hashed API key
    permissions: List[PermissionScope]
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used: Optional[datetime] = None
    is_active: bool = True
    
    class Config:
        orm_mode = True

class APIKeyResponse(BaseModel):
    """API key response model."""
    id: str
    name: str
    description: Optional[str] = None
    permissions: List[PermissionScope]
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used: Optional[datetime] = None
    is_active: bool = True
    # Note: actual key is only returned on creation
    
    class Config:
        orm_mode = True
        use_enum_values = True

class APIKeyWithSecret(APIKeyResponse):
    """API key response with secret (only on creation)."""
    api_key: str

# Audit and Security Models

class LoginAttempt(BaseModel):
    """Login attempt model for security monitoring."""
    username: str
    ip_address: str
    user_agent: Optional[str] = None
    success: bool
    failure_reason: Optional[str] = None
    timestamp: datetime
    location: Optional[str] = None  # Geo-location if available

class SecurityEvent(BaseModel):
    """Security event model for audit logging."""
    event_type: str  # e.g., "login_success", "password_change", "permission_escalation"
    user_id: Optional[str] = None
    username: Optional[str] = None
    ip_address: str
    user_agent: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    severity: str = "info"  # info, warning, error, critical
    timestamp: datetime

# Utility Functions

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def generate_api_key() -> str:
    """Generate a secure API key."""
    return f"ak_{secrets.token_urlsafe(32)}"

def hash_api_key(api_key: str) -> str:
    """Hash an API key for storage."""
    return pwd_context.hash(api_key)

# Role-based permission mapping
ROLE_PERMISSIONS: Dict[UserRole, List[PermissionScope]] = {
    UserRole.GUEST: [
        PermissionScope.PROJECT_READ,
        PermissionScope.KNOWLEDGE_READ,
        PermissionScope.TASK_READ,
    ],
    UserRole.VIEWER: [
        PermissionScope.PROJECT_READ,
        PermissionScope.KNOWLEDGE_READ,
        PermissionScope.TASK_READ,
        PermissionScope.MCP_READ,
    ],
    UserRole.USER: [
        PermissionScope.PROJECT_READ,
        PermissionScope.PROJECT_WRITE,
        PermissionScope.KNOWLEDGE_READ,
        PermissionScope.KNOWLEDGE_WRITE,
        PermissionScope.KNOWLEDGE_UPLOAD,
        PermissionScope.TASK_READ,
        PermissionScope.TASK_WRITE,
        PermissionScope.TASK_EXECUTE,
        PermissionScope.MCP_READ,
        PermissionScope.MCP_WRITE,
    ],
    UserRole.ADMIN: [scope for scope in PermissionScope],  # All permissions
}

def get_role_permissions(role: UserRole) -> List[PermissionScope]:
    """Get default permissions for a role."""
    return ROLE_PERMISSIONS.get(role, [])

# Export commonly used items
__all__ = [
    "UserRole",
    "PermissionScope", 
    "AuthProvider",
    "SessionStatus",
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserInDB",
    "UserResponse",
    "LoginRequest",
    "TokenData",
    "TokenResponse",
    "RefreshTokenRequest",
    "PasswordChangeRequest",
    "PasswordResetRequest",
    "PasswordResetConfirm",
    "SessionCreate",
    "SessionInDB",
    "SessionResponse",
    "PermissionCheck",
    "AuthorizationContext",
    "APIKeyCreate",
    "APIKeyInDB",
    "APIKeyResponse",
    "APIKeyWithSecret",
    "LoginAttempt",
    "SecurityEvent",
    "hash_password",
    "verify_password",
    "generate_api_key",
    "hash_api_key",
    "get_role_permissions",
    "ROLE_PERMISSIONS",
]
