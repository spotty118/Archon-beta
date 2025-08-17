import logging
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from ..config.security_config import verify_token, TokenData

logger = logging.getLogger(__name__)

oauth2_scheme = HTTPBearer()

def get_current_user_from_request(request: Request) -> TokenData:
    """
    Dependency to get the current user from the request.
    This function can be used when authentication is optional.
    """
    authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    scheme, _, credentials = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    
    return verify_token(credentials)

def require_authentication(token: HTTPAuthorizationCredentials = Depends(oauth2_scheme)) -> TokenData:
    """
    FastAPI dependency that requires authentication.
    It validates the provided JWT token and returns the token data.
    """
    return verify_token(token.credentials)

def setup_authentication_middleware(app, enable_auth: bool = True):
    """
    Attach best-effort user context from Authorization header to request.state.user.
    When enable_auth is False, this is a no-op.
    """
    if not enable_auth:
        return

    @app.middleware("http")
    async def attach_user(request: Request, call_next):
        # Default to unauthenticated
        setattr(request.state, "user", None)
        try:
            auth = request.headers.get("Authorization")
            if auth and auth.lower().startswith("bearer "):
                token = auth.split(" ", 1)[1]
                setattr(request.state, "user", verify_token(token))
        except (ValueError, IndexError) as e:
            # Log JWT parsing errors but do not block request processing
            logger.warning(f"Authentication parsing failed: {str(e)}")
            setattr(request.state, "user", None)
        return await call_next(request)