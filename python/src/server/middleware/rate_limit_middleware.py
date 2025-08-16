"""
Enhanced Rate Limiting Middleware with Redis Backend

Implements comprehensive rate limiting with Redis backend support,
sliding window algorithm, and adaptive rate limiting based on user authentication.
"""

import time
import asyncio
import json
import hashlib
from typing import Dict, Optional, Tuple, Any, Union
from collections import defaultdict, deque
from datetime import datetime, timedelta

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)

# Redis client (will be initialized if Redis is available)
redis_client = None

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis not available, using in-memory rate limiting")

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enhanced rate limiting middleware with Redis backend support."""
    
    def __init__(self, app):
        super().__init__(app)
        
        # In-memory storage as fallback
        self.memory_storage: Dict[str, deque] = defaultdict(deque)
        self.lock = asyncio.Lock()
        
        # Rate limit configurations (requests per time window)
        self.rate_limits = {
            # Authentication endpoints - stricter limits
            "/api/auth/login": {"requests": 5, "window": 300, "burst": 2},  # 5 per 5 minutes, burst 2
            "/api/auth/register": {"requests": 3, "window": 3600, "burst": 1},  # 3 per hour, burst 1
            "/api/auth/refresh": {"requests": 20, "window": 300, "burst": 5},  # 20 per 5 minutes
            "/api/auth/logout": {"requests": 10, "window": 60, "burst": 3},
            
            # File upload endpoints - moderate limits
            "/api/knowledge/upload": {"requests": 20, "window": 300, "burst": 5},  # 20 per 5 minutes
            "/api/knowledge/crawl": {"requests": 10, "window": 600, "burst": 2},   # 10 per 10 minutes
            
            # Read operations - higher limits
            "/api/projects": {"requests": 200, "window": 60, "burst": 50},        # 200 per minute
            "/api/knowledge": {"requests": 200, "window": 60, "burst": 50},       # 200 per minute
            "/api/tasks": {"requests": 200, "window": 60, "burst": 50},           # 200 per minute
            "/api/mcp": {"requests": 100, "window": 60, "burst": 25},             # 100 per minute
            
            # Write operations - moderate limits
            "/api/projects/create": {"requests": 30, "window": 300, "burst": 10}, # 30 per 5 minutes
            "/api/tasks/create": {"requests": 60, "window": 300, "burst": 20},    # 60 per 5 minutes
            "/api/knowledge/create": {"requests": 40, "window": 300, "burst": 15},
            
            # WebSocket connections - special handling
            "/socket.io": {"requests": 50, "window": 300, "burst": 10},           # 50 per 5 minutes
            
            # Health/status endpoints - very high limits
            "/health": {"requests": 1000, "window": 60, "burst": 100},
            "/api/health": {"requests": 1000, "window": 60, "burst": 100},
            
            # Default for unlisted endpoints
            "default": {"requests": 100, "window": 60, "burst": 25}
        }
        
        # Global rate limits per user type
        self.global_limits = {
            "authenticated": {"requests": 1000, "window": 60, "burst": 200},  # 1000 per minute
            "admin": {"requests": 2000, "window": 60, "burst": 400},          # 2000 per minute for admins
            "anonymous": {"requests": 100, "window": 60, "burst": 20},        # 100 per minute for anonymous
        }
        
        # Endpoints exempt from rate limiting
        self.exempt_endpoints = {
            "/docs", "/redoc", "/openapi.json", "/static", "/favicon.ico"
        }
        
        # Initialize Redis connection if available
        self._init_redis()

    def _init_redis(self):
        """Initialize Redis connection if available."""
        global redis_client
        
        if not REDIS_AVAILABLE:
            return
        
        try:
            import os
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            redis_client = redis.from_url(redis_url, decode_responses=True)
            logger.info("Redis initialized for rate limiting")
        except Exception as e:
            logger.warning(f"Failed to initialize Redis: {e}")
            redis_client = None

    async def dispatch(self, request: Request, call_next):
        """Process request through rate limiting pipeline."""
        # Skip rate limiting for exempt endpoints
        if any(request.url.path.startswith(exempt) for exempt in self.exempt_endpoints):
            return await call_next(request)
        
        try:
            # Get rate limiting identifiers
            identifier = self._get_identifier(request)
            endpoint_key = self._get_endpoint_key(request)
            user_type = self._get_user_type(request)
            
            # Check rate limits
            rate_limit_result = await self._check_rate_limits(
                identifier, endpoint_key, user_type, request
            )
            
            if not rate_limit_result["allowed"]:
                # Return 429 Too Many Requests
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "Rate limit exceeded",
                        "message": rate_limit_result["message"],
                        "retry_after": rate_limit_result["retry_after"],
                        "limit": rate_limit_result["limit"],
                        "window": rate_limit_result["window"]
                    },
                    headers={
                        "X-RateLimit-Limit": str(rate_limit_result["limit"]),
                        "X-RateLimit-Remaining": str(rate_limit_result["remaining"]),
                        "X-RateLimit-Reset": str(rate_limit_result["reset_time"]),
                        "Retry-After": str(rate_limit_result["retry_after"])
                    }
                )
            
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers to successful responses
            response.headers["X-RateLimit-Limit"] = str(rate_limit_result["limit"])
            response.headers["X-RateLimit-Remaining"] = str(rate_limit_result["remaining"])
            response.headers["X-RateLimit-Reset"] = str(rate_limit_result["reset_time"])
            response.headers["X-RateLimit-Window"] = str(rate_limit_result["window"])
            
            return response
            
        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            # Continue processing even if rate limiting fails
            return await call_next(request)

    async def _check_rate_limits(
        self, identifier: str, endpoint: str, user_type: str, request: Request
    ) -> Dict[str, Any]:
        """Check both endpoint-specific and global rate limits."""
        current_time = time.time()
        
        # Get rate limit configuration
        endpoint_config = self.rate_limits.get(endpoint, self.rate_limits["default"])
        global_config = self.global_limits.get(user_type, self.global_limits["anonymous"])
        
        # Check endpoint-specific limits
        endpoint_result = await self._check_limit(
            f"endpoint:{identifier}:{endpoint}",
            endpoint_config,
            current_time
        )
        
        if not endpoint_result["allowed"]:
            return {
                **endpoint_result,
                "message": f"Endpoint rate limit exceeded for {endpoint}",
                "limit_type": "endpoint"
            }
        
        # Check global user limits
        global_result = await self._check_limit(
            f"global:{identifier}",
            global_config,
            current_time
        )
        
        if not global_result["allowed"]:
            return {
                **global_result,
                "message": f"Global rate limit exceeded for user type {user_type}",
                "limit_type": "global"
            }
        
        # Both limits passed
        return {
            "allowed": True,
            "limit": endpoint_config["requests"],
            "remaining": min(endpoint_result["remaining"], global_result["remaining"]),
            "reset_time": max(endpoint_result["reset_time"], global_result["reset_time"]),
            "window": endpoint_config["window"],
            "retry_after": 0
        }

    async def _check_limit(self, key: str, config: Dict, current_time: float) -> Dict[str, Any]:
        """Check rate limit for a specific key using sliding window."""
        limit = config["requests"]
        window = config["window"]
        burst = config.get("burst", limit // 4)  # Default burst is 25% of limit
        
        if redis_client:
            return await self._check_limit_redis(key, limit, window, burst, current_time)
        else:
            return await self._check_limit_memory(key, limit, window, burst, current_time)

    async def _check_limit_redis(
        self, key: str, limit: int, window: int, burst: int, current_time: float
    ) -> Dict[str, Any]:
        """Check rate limit using Redis with sliding window."""
        try:
            # Use Redis sorted set for sliding window
            pipe = redis_client.pipeline()
            
            # Remove expired entries
            window_start = current_time - window
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Count current requests
            pipe.zcard(key)
            
            # Add current request
            request_id = f"{current_time}:{hash(key) % 10000}"
            pipe.zadd(key, {request_id: current_time})
            
            # Set expiry for the key
            pipe.expire(key, window + 60)  # Extra buffer for cleanup
            
            results = await pipe.execute()
            current_count = results[1]  # Count after cleanup
            
            # Check if limit exceeded (accounting for the just-added request)
            if current_count >= limit:
                # Remove the request we just added since it's rejected
                await redis_client.zrem(key, request_id)
                
                # Calculate retry after
                oldest_requests = await redis_client.zrange(key, 0, 0, withscores=True)
                if oldest_requests:
                    oldest_time = oldest_requests[0][1]
                    retry_after = max(1, int(window - (current_time - oldest_time)))
                else:
                    retry_after = window
                
                return {
                    "allowed": False,
                    "limit": limit,
                    "remaining": 0,
                    "reset_time": int(current_time + retry_after),
                    "window": window,
                    "retry_after": retry_after
                }
            
            return {
                "allowed": True,
                "limit": limit,
                "remaining": max(0, limit - current_count),
                "reset_time": int(current_time + window),
                "window": window,
                "retry_after": 0
            }
            
        except Exception as e:
            logger.error(f"Redis rate limiting error: {e}")
            # Fallback to memory-based limiting
            return await self._check_limit_memory(key, limit, window, burst, current_time)

    async def _check_limit_memory(
        self, key: str, limit: int, window: int, burst: int, current_time: float
    ) -> Dict[str, Any]:
        """Check rate limit using in-memory storage."""
        async with self.lock:
            # Clean old entries
            window_start = current_time - window
            requests = self.memory_storage[key]
            
            while requests and requests[0] < window_start:
                requests.popleft()
            
            current_count = len(requests)
            
            # Check if limit exceeded
            if current_count >= limit:
                # Calculate retry after
                if requests:
                    oldest_time = requests[0]
                    retry_after = max(1, int(window - (current_time - oldest_time)))
                else:
                    retry_after = window
                
                return {
                    "allowed": False,
                    "limit": limit,
                    "remaining": 0,
                    "reset_time": int(current_time + retry_after),
                    "window": window,
                    "retry_after": retry_after
                }
            
            # Add current request
            requests.append(current_time)
            
            # Clean up empty deques
            if not requests:
                del self.memory_storage[key]
            
            return {
                "allowed": True,
                "limit": limit,
                "remaining": max(0, limit - current_count - 1),
                "reset_time": int(current_time + window),
                "window": window,
                "retry_after": 0
            }

    def _get_identifier(self, request: Request) -> str:
        """Get unique identifier for rate limiting."""
        # Try to get user ID from authentication
        if hasattr(request.state, "user") and request.state.user:
            user_id = getattr(request.state.user, "sub", None)
            if user_id:
                return f"user:{user_id}"
        
        # Fallback to IP address
        return f"ip:{self._get_client_ip(request)}"

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address considering proxy headers."""
        # Check for forwarded headers (common in production behind proxies)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain (original client)
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # Fallback to direct connection
        if hasattr(request.client, "host") and request.client.host:
            return request.client.host
        
        return "unknown"

    def _get_endpoint_key(self, request: Request) -> str:
        """Get normalized endpoint key for rate limiting."""
        path = request.url.path
        method = request.method
        
        # Handle parameterized routes
        if path.startswith("/api/projects/") and len(path.split("/")) > 3:
            return "/api/projects"
        elif path.startswith("/api/knowledge/") and len(path.split("/")) > 3:
            return "/api/knowledge"
        elif path.startswith("/api/tasks/") and len(path.split("/")) > 3:
            return "/api/tasks"
        elif path.startswith("/api/mcp/") and len(path.split("/")) > 3:
            return "/api/mcp"
        
        # Handle method-specific endpoints
        if method in ["POST", "PUT", "PATCH"]:
            if path == "/api/projects":
                return "/api/projects/create"
            elif path == "/api/tasks":
                return "/api/tasks/create"
            elif path == "/api/knowledge":
                return "/api/knowledge/create"
        
        return path

    def _get_user_type(self, request: Request) -> str:
        """Determine user type for appropriate rate limiting."""
        if hasattr(request.state, "user") and request.state.user:
            # Check if user has admin permissions
            scopes = getattr(request.state.user, "scopes", [])
            if "admin" in scopes or "superuser" in scopes:
                return "admin"
            return "authenticated"
        
        return "anonymous"

def setup_rate_limiting(app):
    """Setup rate limiting middleware for the FastAPI app."""
    app.add_middleware(RateLimitMiddleware)
    logger.info("Rate limiting middleware enabled")

# Helper functions for debugging and monitoring
async def get_rate_limit_info(identifier: str, endpoint: str) -> Dict[str, Any]:
    """Get current rate limit information for debugging."""
    current_time = time.time()
    
    rate_limits = RateLimitMiddleware(None).rate_limits
    endpoint_config = rate_limits.get(endpoint, rate_limits["default"])
    
    key = f"endpoint:{identifier}:{endpoint}"
    
    if redis_client:
        try:
            current_count = await redis_client.zcard(key)
            
            # Get oldest request time
            oldest_requests = await redis_client.zrange(key, 0, 0, withscores=True)
            oldest_time = oldest_requests[0][1] if oldest_requests else current_time
            
            return {
                "identifier": identifier,
                "endpoint": endpoint,
                "current_requests": current_count,
                "limit": endpoint_config["requests"],
                "window": endpoint_config["window"],
                "window_start": current_time - endpoint_config["window"],
                "oldest_request": oldest_time,
                "remaining": max(0, endpoint_config["requests"] - current_count)
            }
        except Exception as e:
            logger.error(f"Failed to get Redis rate limit info: {e}")
    
    # Fallback to memory info (simplified)
    return {
        "identifier": identifier,
        "endpoint": endpoint,
        "backend": "memory",
        "config": endpoint_config
    }

# Export commonly used items
__all__ = [
    "RateLimitMiddleware",
    "setup_rate_limiting", 
    "get_rate_limit_info",
]
