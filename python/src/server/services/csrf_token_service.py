"""
CSRF Token Service

Provides persistent storage for CSRF tokens using the database instead of memory.
This ensures tokens persist across server restarts and work in clustered deployments.
"""

import secrets
import time
from typing import Optional

from ..utils import get_supabase_client
from ..config.logfire_config import get_logger

logger = get_logger(__name__)


class CSRFTokenService:
    """Service for managing CSRF tokens with database persistence."""
    
    def __init__(self):
        self.supabase = get_supabase_client()
        self.token_expiry_seconds = 3600  # 1 hour
    
    async def generate_token(self, session_id: Optional[str] = None) -> str:
        """
        Generate a new CSRF token and store it in the database.
        
        Args:
            session_id: Optional session identifier for token association
            
        Returns:
            The generated CSRF token
        """
        token = secrets.token_urlsafe(32)
        current_time = int(time.time())
        
        try:
            # Clean up expired tokens first
            await self._cleanup_expired_tokens()
            
            # Store the new token
            result = self.supabase.table("csrf_tokens").insert({
                "token": token,
                "session_id": session_id,
                "created_at": current_time,
                "expires_at": current_time + self.token_expiry_seconds
            }).execute()
            
            if not result.data:
                logger.error("Failed to store CSRF token in database")
                raise Exception("Token storage failed")
                
            logger.debug(f"Generated CSRF token for session {session_id}")
            return token
            
        except Exception as e:
            logger.error(f"Error generating CSRF token: {e}", exc_info=True)
            # In alpha, we want to fail fast on security token generation
            raise Exception(f"CSRF token generation failed: {e}")
    
    async def validate_token(self, token: str, session_id: Optional[str] = None) -> bool:
        """
        Validate a CSRF token against the database.
        
        Args:
            token: The CSRF token to validate
            session_id: Optional session identifier for validation
            
        Returns:
            True if token is valid and not expired, False otherwise
        """
        if not token:
            return False
            
        current_time = int(time.time())
        
        try:
            # Query for the token
            query = self.supabase.table("csrf_tokens").select("*").eq("token", token)
            
            if session_id:
                query = query.eq("session_id", session_id)
                
            result = query.execute()
            
            if not result.data:
                logger.warning(f"Invalid CSRF token attempted: {token[:8]}...")
                return False
            
            token_data = result.data[0]
            
            # Check if token is expired
            if current_time > token_data["expires_at"]:
                logger.warning(f"Expired CSRF token attempted: {token[:8]}...")
                # Remove expired token
                await self._remove_token(token)
                return False
            
            logger.debug(f"Valid CSRF token used for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error validating CSRF token: {e}", exc_info=True)
            # In case of database error, reject the token for security
            return False
    
    async def remove_token(self, token: str) -> bool:
        """
        Remove a CSRF token from storage (e.g., after use if single-use is desired).
        
        Args:
            token: The CSRF token to remove
            
        Returns:
            True if token was removed, False otherwise
        """
        return await self._remove_token(token)
    
    async def _remove_token(self, token: str) -> bool:
        """Internal method to remove a token from the database."""
        try:
            result = self.supabase.table("csrf_tokens").delete().eq("token", token).execute()
            return bool(result.data)
        except Exception as e:
            logger.error(f"Error removing CSRF token: {e}", exc_info=True)
            return False
    
    async def _cleanup_expired_tokens(self) -> None:
        """Clean up expired tokens from the database."""
        current_time = int(time.time())
        
        try:
            result = self.supabase.table("csrf_tokens").delete().lt("expires_at", current_time).execute()
            if result.data:
                logger.debug(f"Cleaned up {len(result.data)} expired CSRF tokens")
        except Exception as e:
            logger.warning(f"Error cleaning up expired CSRF tokens: {e}")
    
    async def cleanup_session_tokens(self, session_id: str) -> None:
        """
        Clean up all tokens for a specific session (e.g., on logout).
        
        Args:
            session_id: Session identifier to clean up tokens for
        """
        try:
            result = self.supabase.table("csrf_tokens").delete().eq("session_id", session_id).execute()
            if result.data:
                logger.debug(f"Cleaned up {len(result.data)} CSRF tokens for session {session_id}")
        except Exception as e:
            logger.warning(f"Error cleaning up session CSRF tokens: {e}")


# Global instance
csrf_token_service = CSRFTokenService()