"""
Rate Limiting Middleware

Implements comprehensive rate limiting to prevent DoS attacks and abuse
across all API endpoints with configurable limits per endpoint type.
"""

import time
import asyncio
from typing import Dict, Optional, Tuple, Any
from collections import defaultdict, deque
from ..config.logfire_config import get_logger

logger = get_logger(__name__)

class RateLimiter:
    """Thread-safe rate limiter with sliding window and burst protection"""
    
    def __init__(self):
        self.requests = defaultdict(lambda: deque())
        self.lock = asyncio.Lock()
        
        # Rate limit configurations (requests per minute)
        self.limits = {
            # Authentication endpoints - stricter limits
            '/api/auth/register': (5, 60),    # 5 requests per minute
            '/api/auth/login': (10, 60),       # 10 requests per minute
            '/api/auth/refresh': (20, 60),     # 20 requests per minute
            
            # File upload endpoints - moderate limits
            '/api/knowledge/upload': (30, 60),  # 30 uploads per minute
            '/api/knowledge/crawl': (20, 60),   # 20 crawls per minute
            
            # Read operations - higher limits
            '/api/projects': (100, 60),         # 100 requests per minute
            '/api/knowledge': (100, 60),        # 100 requests per minute
            '/api/tasks': (100, 60),            # 100 requests per minute
            
            # Write operations - moderate limits
            '/api/projects/create': (20, 60),   # 20 creates per minute
            '/api/tasks/create': (50, 60),      # 50 creates per minute
            
            # Health/status endpoints - very high limits
            '/health': (1000, 60),              # 1000 requests per minute
            '/api/health': (1000, 60),          # 1000 requests per minute
            
            # Default for unlisted endpoints
            'default': (60, 60)                 # 60 requests per minute
        }
        
        # IP-based global limits (requests per minute)
        self.global_limits = {
            'authenticated': (500, 60),    # 500 requests per minute for authenticated users
            'anonymous': (100, 60),        # 100 requests per minute for anonymous users
        }
    
    async def is_allowed(self, identifier: str, endpoint: str, is_authenticated: bool = False) -> Tuple[bool, Dict]:
        """Check if request is allowed and return status info"""
        async with self.lock:
            current_time = time.time()
            
            # Clean old requests (older than window)
            self._cleanup_old_requests(identifier, current_time)
            
            # Get endpoint-specific limits
            limit, window = self.limits.get(endpoint, self.limits['default'])
            
            # Get global limits based on authentication
            global_limit, global_window = (
                self.global_limits['authenticated'] if is_authenticated 
                else self.global_limits['anonymous']
            )
            
            # Count recent requests
            endpoint_key = f"{identifier}:{endpoint}"
            global_key = f"{identifier}:global"
            
            endpoint_requests = len(self.requests[endpoint_key])
            global_requests = len(self.requests[global_key])
            
            # Check endpoint-specific limit
            if endpoint_requests >= limit:
                logger.warning(f"Rate limit exceeded for endpoint {endpoint} for {identifier}: {endpoint_requests}/{limit}")
                return False, {
                    'allowed': False,
                    'limit': limit,
                    'remaining': 0,
                    'reset_time': current_time + window,
                    'retry_after': window
                }
            
            # Check global limit
            if global_requests >= global_limit:
                logger.warning(f"Global rate limit exceeded for {identifier}: {global_requests}/{global_limit}")
                return False, {
                    'allowed': False,
                    'limit': global_limit,
                    'remaining': 0,
                    'reset_time': current_time + global_window,
                    'retry_after': global_window
                }
            
            # Record the request
            self.requests[endpoint_key].append(current_time)
            self.requests[global_key].append(current_time)
            
            return True, {
                'allowed': True,
                'limit': limit,
                'remaining': limit - endpoint_requests - 1,
                'reset_time': current_time + window,
                'retry_after': 0
            }
    
    def _cleanup_old_requests(self, identifier: str, current_time: float):
        """Remove requests older than the window"""
        window_seconds = 60  # 1 minute window
        cutoff_time = current_time - window_seconds
        
        # Clean endpoint-specific requests
        for key in list(self.requests.keys()):
            if key.startswith(identifier):
                requests = self.requests[key]
                while requests and requests[0] < cutoff_time:
                    requests.popleft()
                
                # Remove empty deques
                if not requests:
                    del self.requests[key]
    
    def get_identifier(self, request: Any) -> str:
        """Get unique identifier for rate limiting (IP + User ID if available)"""
        # Try to get user ID from token
        user_id = getattr(request.state, 'user_id', None)
        if user_id:
            return f"user:{user_id}"
        
        # Fallback to IP address
        client_ip = request.client.host if request.client else "unknown"
        
        # Check for forwarded IP headers (behind proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            client_ip = real_ip
        
        return f"ip:{client_ip}"
    
    def get_endpoint_key(self, request: Any) -> str:
        """Get normalized endpoint key for rate limiting"""
        path = request.url.path
        method = request.method
        
        # Normalize common patterns
        if path.startswith('/api/projects/') and len(path.split('/')) > 3:
            # /api/projects/{id} -> /api/projects
            return '/api/projects'
        elif path.startswith('/api/knowledge/') and len(path.split('/')) > 3:
            # /api/knowledge/{id} -> /api/knowledge
            return '/api/knowledge'
        elif path.startswith('/api/tasks/') and len(path.split('/')) > 3:
            # /api/tasks/{id} -> /api/tasks
            return '/api/tasks'
        
        # Special handling for different HTTP methods
        if method == 'POST':
            if path == '/api/projects':
                return '/api/projects/create'
            elif path == '/api/tasks':
                return '/api/tasks/create'
        
        return path

# Global rate limiter instance
rate_limiter = RateLimiter()

# Note: FastAPI middleware class commented out due to import dependencies
# This will be enabled when FastAPI is properly configured in VS Code environment

def create_rate_limit_middleware():
    """
    Factory function to create rate limiting middleware when FastAPI is available.
    Import this function and call it in main.py when ready to enable.
    """
    try:
        from fastapi import Request, HTTPException
        from starlette.middleware.base import BaseHTTPMiddleware
        
        class RateLimitMiddleware(BaseHTTPMiddleware):
            """FastAPI middleware for rate limiting"""
            
            def __init__(self, app):
                super().__init__(app)
                self.limiter = rate_limiter
            
            async def dispatch(self, request: Request, call_next):
                # Skip rate limiting for certain paths
                if request.url.path in ['/docs', '/redoc', '/openapi.json']:
                    return await call_next(request)
                
                # Get rate limiting identifiers
                identifier = self.limiter.get_identifier(request)
                endpoint = self.limiter.get_endpoint_key(request)
                
                # Check if user is authenticated (set by auth middleware)
                is_authenticated = hasattr(request.state, 'user_id') and request.state.user_id is not None
                
                # Check rate limits
                allowed, status = await self.limiter.is_allowed(identifier, endpoint, is_authenticated)
                
                if not allowed:
                    # Return 429 Too Many Requests
                    headers = {
                        'X-RateLimit-Limit': str(status['limit']),
                        'X-RateLimit-Remaining': str(status['remaining']),
                        'X-RateLimit-Reset': str(int(status['reset_time'])),
                        'Retry-After': str(int(status['retry_after']))
                    }
                    
                    raise HTTPException(
                        status_code=429,
                        detail={
                            'error': 'Rate limit exceeded',
                            'message': f'Too many requests. Try again in {status["retry_after"]} seconds.',
                            'retry_after': status['retry_after']
                        },
                        headers=headers
                    )
                
                # Process request
                response = await call_next(request)
                
                # Add rate limit headers to successful responses
                response.headers['X-RateLimit-Limit'] = str(status['limit'])
                response.headers['X-RateLimit-Remaining'] = str(status['remaining'])
                response.headers['X-RateLimit-Reset'] = str(int(status['reset_time']))
                
                return response
        
        return RateLimitMiddleware
        
    except ImportError as e:
        logger.warning(f"FastAPI not available for rate limiting middleware: {e}")
        return None

async def check_rate_limit(request: Any, endpoint: Optional[str] = None) -> bool:
    """Helper function to check rate limits in route handlers"""
    try:
        from fastapi import HTTPException
        
        identifier = rate_limiter.get_identifier(request)
        endpoint_key = endpoint or rate_limiter.get_endpoint_key(request)
        is_authenticated = hasattr(request.state, 'user_id') and request.state.user_id is not None
        
        allowed, status = await rate_limiter.is_allowed(identifier, endpoint_key, is_authenticated)
        
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    'error': 'Rate limit exceeded',
                    'message': f'Too many requests. Try again in {status["retry_after"]} seconds.',
                    'retry_after': status['retry_after']
                }
            )
        
        return True
    except ImportError:
        logger.warning("FastAPI not available for rate limit checking")
        return True

def get_rate_limit_status(request: Any) -> Dict:
    """Get current rate limit status for debugging"""
    identifier = rate_limiter.get_identifier(request)
    endpoint = rate_limiter.get_endpoint_key(request)
    
    endpoint_key = f"{identifier}:{endpoint}"
    global_key = f"{identifier}:global"
    
    current_time = time.time()
    window_start = current_time - 60  # 1 minute window
    
    # Count recent requests
    endpoint_requests = len([req for req in rate_limiter.requests[endpoint_key] 
                           if req > window_start])
    global_requests = len([req for req in rate_limiter.requests[global_key] 
                          if req > window_start])
    
    endpoint_limit, _ = rate_limiter.limits.get(endpoint, rate_limiter.limits['default'])
    
    return {
        'identifier': identifier,
        'endpoint': endpoint,
        'endpoint_requests': endpoint_requests,
        'endpoint_limit': endpoint_limit,
        'global_requests': global_requests,
        'window_start': window_start,
        'current_time': current_time
    }