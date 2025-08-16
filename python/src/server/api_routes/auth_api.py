"""
Authentication API endpoints for Archon backend.
Handles user authentication, token management, and session control.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext

from ..config.logfire_config import get_logger
from ..config.security_config import (
    create_access_token,
    get_security_settings,
    validate_input,
    TokenData
)
from ..utils import get_supabase_client
from ..security.api_key_encryption import (
    encrypt_api_keys_for_user,
    decrypt_api_keys_for_user,
    get_client_encryption_params
)

logger = get_logger(__name__)
router = APIRouter(prefix="/api/auth", tags=["authentication"])

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=100)

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: Optional[str] = Field(None, max_length=100)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    username: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: Optional[str]
    created_at: datetime
    is_active: bool

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)

@router.post("/register", response_model=UserResponse)
async def register_user(request: RegisterRequest):
    """Register a new user account."""
    try:
        # Input validation
        username = validate_input(request.username, "username")
        email = validate_input(request.email, "email") 
        password = validate_input(request.password, "password")
        full_name = validate_input(request.full_name, "full_name") if request.full_name else None
        
        logger.info(f"User registration attempt: {username}")
        
        # Check password strength
        if len(password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long"
            )
        
        supabase = get_supabase_client()
        
        # Check if user already exists
        try:
            existing_user = supabase.table("users").select("id").eq("username", username).execute()
            if existing_user.data:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Username already exists"
                )
                
            existing_email = supabase.table("users").select("id").eq("email", email).execute()
            if existing_email.data:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already registered"
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            logger.error(f"Database error checking existing user: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error"
            )
        
        # Hash password
        password_hash = get_password_hash(password)
        
        # Create user
        try:
            user_data = {
                "username": username,
                "email": email,
                "password_hash": password_hash,
                "full_name": full_name,
                "is_active": True,
                "created_at": datetime.utcnow().isoformat(),
            }
            
            result = supabase.table("users").insert(user_data).execute()
            
            if not result.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create user"
                )
            
            user = result.data[0]
            logger.info(f"User registered successfully: {username}")
            
            return UserResponse(
                id=user["id"],
                username=user["username"],
                email=user["email"],
                full_name=user.get("full_name"),
                created_at=datetime.fromisoformat(user["created_at"].replace("Z", "+00:00")),
                is_active=user["is_active"]
            )
            
        except Exception as e:
            logger.error(f"Database error creating user: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user account"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/login", response_model=TokenResponse)
async def login_user(request: LoginRequest):
    """Authenticate user and return access token."""
    try:
        # Input validation
        username = validate_input(request.username, "username")
        password = validate_input(request.password, "password")
        
        logger.info(f"Login attempt: {username}")
        
        supabase = get_supabase_client()
        
        # Get user from database
        try:
            result = supabase.table("users").select("*").eq("username", username).execute()
            
            if not result.data:
                logger.warning(f"Login failed - user not found: {username}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid username or password"
                )
            
            user = result.data[0]
            
            # Check if user is active
            if not user.get("is_active", False):
                logger.warning(f"Login failed - inactive user: {username}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Account is disabled"
                )
            
            # Verify password
            if not verify_password(password, user["password_hash"]):
                logger.warning(f"Login failed - invalid password: {username}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid username or password"
                )
            
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            logger.error(f"Database error during login: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication service error"
            )
        
        # Create access token
        security_settings = get_security_settings()
        token_data = {
            "sub": user["id"],
            "username": username,
            "scopes": ["user"]
        }
        
        access_token = create_access_token(
            data=token_data,
            expires_delta=timedelta(minutes=security_settings.access_token_expire_minutes)
        )
        
        logger.info(f"Login successful: {username}")
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=security_settings.access_token_expire_minutes * 60,
            user_id=user["id"],
            username=username
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )

@router.get("/me", response_model=UserResponse)
async def get_current_user(request: Request):
    """Get current authenticated user information."""
    try:
        # This endpoint requires authentication via middleware
        from ..middleware.auth_middleware import require_authentication
        
        token_data = require_authentication(request)
        
        supabase = get_supabase_client()
        
        # Get user from database
        try:
            result = supabase.table("users").select("id,username,email,full_name,created_at,is_active").eq("id", token_data.sub).execute()
            
            if not result.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            
            user = result.data[0]
            
            return UserResponse(
                id=user["id"],
                username=user["username"],
                email=user["email"],
                full_name=user.get("full_name"),
                created_at=datetime.fromisoformat(user["created_at"].replace("Z", "+00:00")),
                is_active=user["is_active"]
            )
            
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            logger.error(f"Database error getting user: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get user information"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get current user error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user information"
        )

@router.post("/logout")
async def logout_user(request: Request):
    """Logout current user (client should delete token)."""
    try:
        from ..middleware.auth_middleware import get_current_user_from_request
        
        user = get_current_user_from_request(request)
        if user:
            logger.info(f"User logged out: {user.sub}")
        
        return {"message": "Logged out successfully"}
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return {"message": "Logged out"}

@router.post("/encrypt-keys")
async def encrypt_api_keys(request: dict):
    """
    Encrypt API keys for secure client-side storage
    
    Body should contain:
    {
        "api_keys": {"service_name": "api_key", ...},
        "session_token": "user_session_token",
        "user_id": "user_id"
    }
    """
    try:
        api_keys = request.get("api_keys", {})
        session_token = request.get("session_token")
        user_id = request.get("user_id")
        
        if not session_token or not user_id:
            raise HTTPException(status_code=400, detail="Session token and user ID required")
        
        # Encrypt the API keys
        encrypted_keys = encrypt_api_keys_for_user(api_keys, user_id, session_token)
        
        # Get client encryption parameters for additional client-side encryption
        client_params = get_client_encryption_params(user_id, session_token)
        
        return {
            "encrypted_keys": encrypted_keys,
            "client_params": client_params,
            "success": True
        }
        
    except Exception as e:
        logger.error(f"API key encryption failed: {e}")
        raise HTTPException(status_code=500, detail="Encryption failed")

@router.post("/decrypt-keys")
async def decrypt_api_keys(request: dict):
    """
    Decrypt API keys from secure storage
    
    Body should contain:
    {
        "encrypted_keys": {"service_name": "encrypted_data", ...},
        "session_token": "user_session_token",
        "user_id": "user_id"
    }
    """
    try:
        encrypted_keys = request.get("encrypted_keys", {})
        session_token = request.get("session_token")
        user_id = request.get("user_id")
        
        if not session_token or not user_id:
            raise HTTPException(status_code=400, detail="Session token and user ID required")
        
        # Decrypt the API keys
        decrypted_keys = decrypt_api_keys_for_user(encrypted_keys, user_id, session_token)
        
        return {
            "api_keys": decrypted_keys,
            "success": True
        }
        
    except Exception as e:
        logger.error(f"API key decryption failed: {e}")
        raise HTTPException(status_code=500, detail="Decryption failed")

@router.get("/encryption-params")
async def get_encryption_params(request: Request):
    """
    Get encryption parameters for client-side key encryption
    
    Returns parameters needed for the client to encrypt API keys locally
    """
    try:
        # Get user from auth middleware
        from ..middleware.auth_middleware import get_current_user_from_request
        
        user = get_current_user_from_request(request)
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Generate a temporary session token for parameter generation
        import secrets
        session_token = secrets.token_urlsafe(32)
        
        user_id = user.sub
        client_params = get_client_encryption_params(user_id, session_token)
        
        return {
            "params": client_params,
            "session_token": session_token,
            "success": True
        }
        
    except Exception as e:
        logger.error(f"Failed to get encryption params: {e}")
        raise HTTPException(status_code=500, detail="Failed to get encryption parameters")

# Health check for auth service
@router.get("/health")
async def auth_health():
    """Health check for authentication service."""
    try:
        security_settings = get_security_settings()
        
        return {
            "status": "healthy",
            "service": "authentication",
            "settings": {
                "rate_limiting": security_settings.rate_limit_enabled,
                "security_headers": security_settings.enable_security_headers,
                "token_expire_minutes": security_settings.access_token_expire_minutes
            }
        }
        
    except Exception as e:
        logger.error(f"Auth health check error: {e}")
        return {
            "status": "error",
            "service": "authentication",
            "error": str(e)
        }