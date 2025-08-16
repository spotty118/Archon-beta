"""
Rate Limiting Utilities

Simplified rate limiting functionality that works without external FastAPI dependencies.
Provides the core security logic for preventing DoS attacks.
"""

import time
import asyncio
from typing import Dict, Optional, Tuple
from collections import defaultdict, deque
from ..config.logfire_config import get_logger

logger = get_logger(__name__)

class SimpleRateLimiter:
    """Basic rate limiter with sliding window implementation"""
    
    def __init__(self):
        self.requests = defaultdict(lambda: deque())
        self.lock = asyncio.Lock()
        
        # Rate limit configurations (requests per minute)
        self.limits = {
            # Authentication endpoints - stricter limits
            '/api/auth/register': (5, 60),    # 5 requests per minute
            '/api/auth/login': (10, 60),       # 10 requests per minute
            
            # File upload endpoints - moderate limits
            '/api/knowledge/upload': (30, 60),  # 30 uploads per minute
            '/api/knowledge/crawl': (20, 60),   # 20 crawls per minute
            
            # Read operations - higher limits
            '/api/projects': (100, 60),         # 100 requests per minute
            '/api/knowledge': (100, 60),        # 100 requests per minute
            
            # Default for unlisted endpoints
            'default': (60, 60)                 # 60 requests per minute
        }
    
    async def is_allowed(self, identifier: str, endpoint: str) -> Tuple[bool, Dict]:
        """Check if request is allowed based on rate limits"""
        async with self.lock:
            current_time = time.time()
            
            # Clean old requests
            self._cleanup_old_requests(identifier, current_time)
            
            # Get endpoint-specific limits
            limit, window = self.limits.get(endpoint, self.limits['default'])
            
            # Count recent requests
            endpoint_key = f"{identifier}:{endpoint}"
            recent_requests = len(self.requests[endpoint_key])
            
            # Check limit
            if recent_requests >= limit:
                logger.warning(f"Rate limit exceeded: {endpoint} for {identifier} ({recent_requests}/{limit})")
                return False, {
                    'allowed': False,
                    'limit': limit,
                    'remaining': 0,
                    'reset_time': current_time + window
                }
            
            # Record the request
            self.requests[endpoint_key].append(current_time)
            
            return True, {
                'allowed': True,
                'limit': limit,
                'remaining': limit - recent_requests - 1,
                'reset_time': current_time + window
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

# Global rate limiter instance
global_rate_limiter = SimpleRateLimiter()

async def check_rate_limit(identifier: str, endpoint: str) -> bool:
    """Helper function to check rate limits"""
    allowed, status = await global_rate_limiter.is_allowed(identifier, endpoint)
    return allowed

def get_rate_limit_status(identifier: str, endpoint: str) -> Dict:
    """Get current rate limit status"""
    limit, _ = global_rate_limiter.limits.get(endpoint, global_rate_limiter.limits['default'])
    endpoint_key = f"{identifier}:{endpoint}"
    current_requests = len(global_rate_limiter.requests[endpoint_key])
    
    return {
        'identifier': identifier,
        'endpoint': endpoint,
        'current_requests': current_requests,
        'limit': limit,
        'remaining': max(0, limit - current_requests)
    }