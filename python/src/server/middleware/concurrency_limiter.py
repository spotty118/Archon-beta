"""
Concurrency Limiting Middleware

Prevents resource exhaustion by limiting concurrent requests and operations.
Implements per-endpoint concurrency limits with graceful degradation.
"""

import asyncio
import time
from typing import Dict, Optional, Set, Any
from collections import defaultdict
from ..config.logfire_config import get_logger

logger = get_logger(__name__)

# Note: This middleware requires FastAPI to be properly installed
# For now, providing the structure for when dependencies are available

class ConcurrencyLimiter:
    """Thread-safe concurrency limiter with per-endpoint limits"""
    
    def __init__(self):
        self.active_requests = defaultdict(int)
        self.request_queues = defaultdict(set)
        self.lock = asyncio.Lock()
        
        # Concurrency limits per endpoint (concurrent requests)
        self.limits = {
            # File upload endpoints - low concurrency to prevent memory issues
            '/api/knowledge/upload': 3,
            '/api/knowledge/crawl': 2,
            
            # Heavy processing endpoints
            '/api/knowledge/search': 10,
            '/api/knowledge/embed': 5,
            
            # Agent/chat endpoints - moderate limits
            '/api/agents/chat': 8,
            '/api/agents/stream': 5,
            
            # Database operations - moderate limits
            '/api/projects/create': 15,
            '/api/projects/update': 15,
            '/api/tasks/create': 20,
            '/api/tasks/update': 20,
            
            # Read operations - higher limits
            '/api/projects': 50,
            '/api/knowledge': 30,
            '/api/tasks': 40,
            
            # Authentication endpoints - moderate limits
            '/api/auth/login': 10,
            '/api/auth/register': 5,
            '/api/auth/encrypt-keys': 8,
            '/api/auth/decrypt-keys': 8,
            
            # Health checks - very high limits
            '/health': 100,
            '/api/health': 100,
            
            # Default for unlisted endpoints
            'default': 25
        }
        
        # Global limits
        self.global_limit = 200  # Total concurrent requests across all endpoints
        self.global_active = 0
        
        # Request timeout settings (seconds)
        self.timeout_limits = {
            '/api/knowledge/upload': 300,    # 5 minutes for uploads
            '/api/knowledge/crawl': 180,     # 3 minutes for crawling
            '/api/agents/chat': 120,         # 2 minutes for chat
            '/api/agents/stream': 300,       # 5 minutes for streaming
            'default': 60                    # 1 minute default
        }
    
    def get_endpoint_key(self, request: Any) -> str:
        """Get normalized endpoint key for concurrency limiting"""
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
        elif method in ['PUT', 'PATCH']:
            if path.startswith('/api/projects/'):
                return '/api/projects/update'
            elif path.startswith('/api/tasks/'):
                return '/api/tasks/update'
        
        return path
    
    async def acquire(self, endpoint: str, request_id: str) -> bool:
        """Acquire concurrency slot for endpoint"""
        async with self.lock:
            # Check global limit
            if self.global_active >= self.global_limit:
                logger.warning(f"Global concurrency limit exceeded - active: {self.global_active}, limit: {self.global_limit}")
                return False
            
            # Check endpoint-specific limit
            limit = self.limits.get(endpoint, self.limits['default'])
            current = self.active_requests[endpoint]
            
            if current >= limit:
                logger.warning(f"Endpoint concurrency limit exceeded - endpoint: {endpoint}, active: {current}, limit: {limit}")
                return False
            
            # Acquire slots
            self.active_requests[endpoint] += 1
            self.global_active += 1
            self.request_queues[endpoint].add(request_id)
            
            logger.debug(f"Concurrency slot acquired - endpoint: {endpoint}, request_id: {request_id}, active: {self.active_requests[endpoint]}, limit: {limit}")
            return True
    
    async def release(self, endpoint: str, request_id: str):
        """Release concurrency slot"""
        async with self.lock:
            if request_id in self.request_queues[endpoint]:
                self.request_queues[endpoint].remove(request_id)
                self.active_requests[endpoint] = max(0, self.active_requests[endpoint] - 1)
                self.global_active = max(0, self.global_active - 1)
                
                logger.debug(f"Concurrency slot released - endpoint: {endpoint}, request_id: {request_id}, active: {self.active_requests[endpoint]}")
    
    def get_timeout(self, endpoint: str) -> float:
        """Get timeout for endpoint"""
        return self.timeout_limits.get(endpoint, self.timeout_limits['default'])
    
    def get_status(self) -> Dict:
        """Get current concurrency status"""
        return {
            'global_active': self.global_active,
            'global_limit': self.global_limit,
            'endpoint_limits': dict(self.limits),
            'active_by_endpoint': dict(self.active_requests),
            'utilization': {
                endpoint: (self.active_requests[endpoint] / limit * 100) 
                for endpoint, limit in self.limits.items()
                if self.active_requests[endpoint] > 0
            }
        }

# Global concurrency limiter instance
concurrency_limiter = ConcurrencyLimiter()

# Note: FastAPI middleware class commented out due to import dependencies
# This will be enabled when FastAPI is properly configured in VS Code environment
#
# class ConcurrencyLimitMiddleware(BaseHTTPMiddleware):
#     """FastAPI middleware for concurrency limiting"""
#
#     def __init__(self, app):
#         super().__init__(app)
#         self.limiter = concurrency_limiter
#
#     async def dispatch(self, request: Any, call_next):
#         # Implementation available but commented out for VS Code compatibility
#         pass

def create_concurrency_middleware():
    """
    Factory function to create concurrency middleware when FastAPI is available.
    Import this function and call it in main.py when ready to enable.
    """
    try:
        from fastapi import Request, Response
        from fastapi.middleware.base import BaseHTTPMiddleware
        
        class ConcurrencyLimitMiddleware(BaseHTTPMiddleware):
            """FastAPI middleware for concurrency limiting"""
            
            def __init__(self, app):
                super().__init__(app)
                self.limiter = concurrency_limiter
            
            async def dispatch(self, request: Request, call_next):
                # Skip concurrency limiting for certain paths
                if request.url.path in ['/docs', '/redoc', '/openapi.json']:
                    return await call_next(request)
                
                # Generate unique request ID
                request_id = f"{id(request)}_{time.time()}"
                endpoint = self.limiter.get_endpoint_key(request)
                
                # Try to acquire concurrency slot
                acquired = await self.limiter.acquire(endpoint, request_id)
                
                if not acquired:
                    # Return 503 Service Unavailable with retry information
                    return Response(
                        content='{"error": "Service temporarily unavailable", "message": "Too many concurrent requests. Please try again later.", "retry_after": 5}',
                        status_code=503,
                        headers={
                            'Content-Type': 'application/json',
                            'Retry-After': '5',
                            'X-Concurrency-Limit': str(self.limiter.limits.get(endpoint, self.limiter.limits['default'])),
                            'X-Concurrency-Active': str(self.limiter.active_requests[endpoint])
                        }
                    )
                
                try:
                    # Get timeout for this endpoint
                    timeout = self.limiter.get_timeout(endpoint)
                    
                    # Process request with timeout
                    try:
                        response = await asyncio.wait_for(call_next(request), timeout=timeout)
                        
                        # Add concurrency headers to response
                        response.headers['X-Concurrency-Limit'] = str(self.limiter.limits.get(endpoint, self.limiter.limits['default']))
                        response.headers['X-Concurrency-Active'] = str(self.limiter.active_requests[endpoint])
                        response.headers['X-Concurrency-Available'] = str(
                            self.limiter.limits.get(endpoint, self.limiter.limits['default']) - self.limiter.active_requests[endpoint]
                        )
                        
                        return response
                        
                    except asyncio.TimeoutError:
                        logger.warning(f"Request timeout - endpoint: {endpoint}, request_id: {request_id}, timeout: {timeout}")
                        
                        return Response(
                            content='{"error": "Request timeout", "message": "Request took too long to process.", "timeout": ' + str(timeout) + '}',
                            status_code=504,
                            headers={
                                'Content-Type': 'application/json',
                                'X-Request-Timeout': str(timeout)
                            }
                        )
                        
                finally:
                    # Always release the concurrency slot
                    await self.limiter.release(endpoint, request_id)
        
        return ConcurrencyLimitMiddleware
        
    except ImportError as e:
        logger.warning(f"FastAPI not available for concurrency middleware: {e}")
        return None

async def get_concurrency_status() -> Dict:
    """Get current concurrency status"""
    return concurrency_limiter.get_status()

async def check_concurrency_available(endpoint: str) -> bool:
    """Check if concurrency slot is available for endpoint"""
    limit = concurrency_limiter.limits.get(endpoint, concurrency_limiter.limits['default'])
    current = concurrency_limiter.active_requests[endpoint]
    return current < limit

def get_endpoint_limits() -> Dict[str, int]:
    """Get all endpoint concurrency limits"""
    return dict(concurrency_limiter.limits)

def update_endpoint_limit(endpoint: str, limit: int) -> bool:
    """Update concurrency limit for an endpoint"""
    try:
        if limit > 0:
            concurrency_limiter.limits[endpoint] = limit
            logger.info(f"Updated concurrency limit - endpoint: {endpoint}, limit: {limit}")
            return True
        return False
    except Exception as e:
        logger.error(f"Failed to update concurrency limit: {e}")
        return False