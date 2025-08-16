"""
Concurrency limiting utilities for preventing resource exhaustion.
This module provides simplified concurrency management without external dependencies.
"""

import asyncio
import time
import threading
from typing import Dict, Optional, Any
from ..config.logfire_config import get_logger

logger = get_logger(__name__)


class ConcurrencyLimiter:
    """
    Thread-safe concurrency limiter for preventing resource exhaustion.
    Tracks active requests per endpoint and enforces limits.
    """
    
    def __init__(self, global_limit: int = 1000, default_limit: int = 50):
        self.global_limit = global_limit
        self.default_limit = default_limit
        self.global_active = 0
        self.active_requests: Dict[str, int] = {}
        self.endpoint_limits: Dict[str, int] = {}
        self.request_tracking: Dict[str, Dict[str, float]] = {}
        self._lock = threading.RLock()
        
    def get_endpoint_key(self, path: str, method: str = "GET") -> str:
        """Generate consistent endpoint key for tracking."""
        return f"{method}:{path}"
    
    def set_endpoint_limit(self, endpoint: str, limit: int) -> None:
        """Set concurrency limit for specific endpoint."""
        with self._lock:
            self.endpoint_limits[endpoint] = limit
            logger.info(f"Updated concurrency limit: {endpoint} -> {limit}")
    
    def can_accept_request(self, endpoint: str) -> tuple[bool, str]:
        """
        Check if request can be accepted based on concurrency limits.
        Returns (can_accept, reason_if_rejected).
        """
        with self._lock:
            # Check global limit
            if self.global_active >= self.global_limit:
                return False, f"Global concurrency limit reached ({self.global_limit})"
            
            # Check endpoint-specific limit
            limit = self.endpoint_limits.get(endpoint, self.default_limit)
            current = self.active_requests.get(endpoint, 0)
            
            if current >= limit:
                return False, f"Endpoint concurrency limit reached ({limit})"
            
            return True, ""
    
    def start_request(self, endpoint: str, request_id: str) -> bool:
        """
        Start tracking a request. Returns True if accepted, False if rejected.
        """
        with self._lock:
            can_accept, reason = self.can_accept_request(endpoint)
            
            if not can_accept:
                logger.warning(f"Request rejected: {reason} - endpoint: {endpoint}, request_id: {request_id}")
                return False
            
            # Accept the request
            self.global_active += 1
            self.active_requests[endpoint] = self.active_requests.get(endpoint, 0) + 1
            
            # Track request start time
            if endpoint not in self.request_tracking:
                self.request_tracking[endpoint] = {}
            self.request_tracking[endpoint][request_id] = time.time()
            
            logger.debug(f"Request started - endpoint: {endpoint}, request_id: {request_id}, active: {self.active_requests[endpoint]}")
            return True
    
    def finish_request(self, endpoint: str, request_id: str) -> None:
        """Stop tracking a request."""
        with self._lock:
            # Update counters
            if self.global_active > 0:
                self.global_active -= 1
            
            if endpoint in self.active_requests and self.active_requests[endpoint] > 0:
                self.active_requests[endpoint] -= 1
            
            # Remove request tracking
            if (endpoint in self.request_tracking and 
                request_id in self.request_tracking[endpoint]):
                start_time = self.request_tracking[endpoint].pop(request_id)
                duration = time.time() - start_time
                
                logger.debug(f"Request finished - endpoint: {endpoint}, request_id: {request_id}, duration: {duration:.2f}s, active: {self.active_requests.get(endpoint, 0)}")
    
    def cleanup_expired_requests(self, timeout_seconds: int = 300) -> int:
        """
        Clean up requests that have been running too long.
        Returns number of requests cleaned up.
        """
        cleaned = 0
        current_time = time.time()
        
        with self._lock:
            for endpoint in list(self.request_tracking.keys()):
                for request_id in list(self.request_tracking[endpoint].keys()):
                    start_time = self.request_tracking[endpoint][request_id]
                    
                    if current_time - start_time > timeout_seconds:
                        logger.warning(f"Cleaning up expired request - endpoint: {endpoint}, request_id: {request_id}, duration: {current_time - start_time:.2f}s")
                        
                        self.finish_request(endpoint, request_id)
                        cleaned += 1
        
        return cleaned
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current concurrency statistics."""
        with self._lock:
            return {
                "global_active": self.global_active,
                "global_limit": self.global_limit,
                "endpoint_stats": {
                    endpoint: {
                        "active": self.active_requests.get(endpoint, 0),
                        "limit": self.endpoint_limits.get(endpoint, self.default_limit)
                    }
                    for endpoint in set(list(self.active_requests.keys()) + 
                                      list(self.endpoint_limits.keys()))
                }
            }


class RequestTracker:
    """Context manager for tracking individual requests."""
    
    def __init__(self, limiter: ConcurrencyLimiter, endpoint: str, request_id: str):
        self.limiter = limiter
        self.endpoint = endpoint
        self.request_id = request_id
        self.accepted = False
    
    def __enter__(self):
        self.accepted = self.limiter.start_request(self.endpoint, self.request_id)
        if not self.accepted:
            raise RuntimeError(f"Request rejected by concurrency limiter")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.accepted:
            self.limiter.finish_request(self.endpoint, self.request_id)


# Global limiter instance
_global_limiter = None
_limiter_lock = threading.Lock()


def get_concurrency_limiter() -> ConcurrencyLimiter:
    """Get the global concurrency limiter instance."""
    global _global_limiter
    
    if _global_limiter is None:
        with _limiter_lock:
            if _global_limiter is None:
                _global_limiter = ConcurrencyLimiter()
    
    return _global_limiter


def track_request(endpoint: str, request_id: str) -> RequestTracker:
    """
    Context manager for tracking a request.
    
    Usage:
        try:
            with track_request("POST:/api/projects", "req_123"):
                # Process request
                pass
        except RuntimeError as e:
            # Request was rejected
            return error_response(str(e))
    """
    limiter = get_concurrency_limiter()
    return RequestTracker(limiter, endpoint, request_id)


async def cleanup_expired_requests_task():
    """Background task to periodically clean up expired requests."""
    limiter = get_concurrency_limiter()
    
    while True:
        try:
            cleaned = limiter.cleanup_expired_requests()
            if cleaned > 0:
                logger.info(f"Cleaned up {cleaned} expired requests")
            
            await asyncio.sleep(60)  # Check every minute
            
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")
            await asyncio.sleep(60)