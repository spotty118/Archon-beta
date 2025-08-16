"""
HTTP Client Service for Archon V2 Beta Enhancement

Provides connection pooling, retry logic, and performance optimization for HTTP requests.
Designed for high-performance MCP service communication and external API calls.

Features:
- Connection pooling with configurable limits
- Automatic retry with exponential backoff
- Request/response logging and metrics
- Timeout handling and circuit breaker pattern
- Session management for persistent connections
"""

import asyncio
import hashlib
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union
from urllib.parse import urljoin, urlparse

import aiohttp
from aiohttp import ClientSession, ClientTimeout, TCPConnector
from aiohttp.client_exceptions import ClientError, ClientResponseError

# Logger setup
logger = logging.getLogger(__name__)


class ConnectionPoolConfig:
    """Configuration for HTTP connection pooling."""
    
    def __init__(
        self,
        max_connections: int = 100,
        max_connections_per_host: int = 20,
        connection_timeout: float = 10.0,
        read_timeout: float = 30.0,
        total_timeout: float = 60.0,
        keepalive_timeout: float = 30.0,
        enable_cleanup_closed: bool = True,
        connector_limit: int = 100,
        connector_limit_per_host: int = 30,
    ):
        self.max_connections = max_connections
        self.max_connections_per_host = max_connections_per_host
        self.connection_timeout = connection_timeout
        self.read_timeout = read_timeout
        self.total_timeout = total_timeout
        self.keepalive_timeout = keepalive_timeout
        self.enable_cleanup_closed = enable_cleanup_closed
        self.connector_limit = connector_limit
        self.connector_limit_per_host = connector_limit_per_host


class RetryConfig:
    """Configuration for request retry logic."""
    
    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
        retry_on_status: set = None,
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
        self.retry_on_status = retry_on_status or {408, 429, 502, 503, 504}


class CircuitBreakerConfig:
    """Configuration for circuit breaker pattern."""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: type = ClientError,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception


class CircuitBreakerState:
    """Circuit breaker state management."""
    
    def __init__(self, config: CircuitBreakerConfig):
        self.config = config
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = "closed"  # closed, open, half-open
    
    def can_execute(self) -> bool:
        """Check if request can be executed based on circuit breaker state."""
        if self.state == "closed":
            return True
        elif self.state == "open":
            if self.last_failure_time and (
                datetime.now() - self.last_failure_time
            ).total_seconds() > self.config.recovery_timeout:
                self.state = "half-open"
                return True
            return False
        elif self.state == "half-open":
            return True
        return False
    
    def record_success(self):
        """Record successful request."""
        self.failure_count = 0
        self.state = "closed"
        self.last_failure_time = None
    
    def record_failure(self):
        """Record failed request."""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.config.failure_threshold:
            self.state = "open"


class RequestMetrics:
    """Request metrics tracking."""
    
    def __init__(self):
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.retried_requests = 0
        self.circuit_breaker_opens = 0
        self.total_response_time = 0.0
        self.requests_by_host: Dict[str, int] = {}
        self.response_times_by_host: Dict[str, list] = {}
    
    def record_request(self, host: str, success: bool, response_time: float, retried: bool = False):
        """Record request metrics."""
        self.total_requests += 1
        
        if success:
            self.successful_requests += 1
        else:
            self.failed_requests += 1
        
        if retried:
            self.retried_requests += 1
        
        self.total_response_time += response_time
        
        # Per-host metrics
        self.requests_by_host[host] = self.requests_by_host.get(host, 0) + 1
        if host not in self.response_times_by_host:
            self.response_times_by_host[host] = []
        self.response_times_by_host[host].append(response_time)
        
        # Keep only last 100 response times per host
        if len(self.response_times_by_host[host]) > 100:
            self.response_times_by_host[host] = self.response_times_by_host[host][-100:]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive metrics statistics."""
        avg_response_time = (
            self.total_response_time / self.total_requests if self.total_requests > 0 else 0
        )
        
        success_rate = (
            (self.successful_requests / self.total_requests * 100) 
            if self.total_requests > 0 else 0
        )
        
        host_stats = {}
        for host, times in self.response_times_by_host.items():
            if times:
                host_stats[host] = {
                    "requests": self.requests_by_host.get(host, 0),
                    "avg_response_time": sum(times) / len(times),
                    "min_response_time": min(times),
                    "max_response_time": max(times),
                }
        
        return {
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "retried_requests": self.retried_requests,
            "circuit_breaker_opens": self.circuit_breaker_opens,
            "success_rate": round(success_rate, 2),
            "average_response_time": round(avg_response_time, 3),
            "host_statistics": host_stats,
        }


class HTTPClientService:
    """
    High-performance HTTP client service with connection pooling and advanced features.
    
    Optimized for MCP service communication and external API calls.
    """
    
    def __init__(
        self,
        pool_config: Optional[ConnectionPoolConfig] = None,
        retry_config: Optional[RetryConfig] = None,
        circuit_breaker_config: Optional[CircuitBreakerConfig] = None,
    ):
        self.pool_config = pool_config or ConnectionPoolConfig()
        self.retry_config = retry_config or RetryConfig()
        self.circuit_breaker_config = circuit_breaker_config or CircuitBreakerConfig()
        
        self.session: Optional[ClientSession] = None
        self.connector: Optional[TCPConnector] = None
        self.circuit_breakers: Dict[str, CircuitBreakerState] = {}
        self.metrics = RequestMetrics()
        
        # Session management
        self.session_created_at: Optional[datetime] = None
        self.session_max_age = timedelta(hours=1)  # Recreate session every hour
    
    async def initialize(self) -> bool:
        """Initialize HTTP client with connection pooling."""
        try:
            # Create TCP connector with pooling configuration
            self.connector = TCPConnector(
                limit=self.pool_config.connector_limit,
                limit_per_host=self.pool_config.connector_limit_per_host,
                keepalive_timeout=self.pool_config.keepalive_timeout,
                enable_cleanup_closed=self.pool_config.enable_cleanup_closed,
                use_dns_cache=True,
                ttl_dns_cache=300,  # 5 minutes DNS cache
                family=0,  # Auto-detect IPv4/IPv6
            )
            
            # Create timeout configuration
            timeout = ClientTimeout(
                total=self.pool_config.total_timeout,
                connect=self.pool_config.connection_timeout,
                sock_read=self.pool_config.read_timeout,
            )
            
            # Create client session
            self.session = ClientSession(
                connector=self.connector,
                timeout=timeout,
                connector_owner=True,
                trust_env=True,  # Use environment proxy settings
            )
            
            self.session_created_at = datetime.now()
            logger.info("✅ HTTP client service initialized with connection pooling")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize HTTP client service: {e}")
            return False
    
    async def close(self):
        """Close HTTP client and cleanup resources."""
        try:
            if self.session and not self.session.closed:
                await self.session.close()
            
            if self.connector:
                await self.connector.close()
            
            logger.info("✅ HTTP client service closed")
            
        except Exception as e:
            logger.warning(f"Error closing HTTP client service: {e}")
    
    def _get_host_key(self, url: str) -> str:
        """Extract host key for circuit breaker tracking."""
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}"
    
    def _get_circuit_breaker(self, host_key: str) -> CircuitBreakerState:
        """Get or create circuit breaker for host."""
        if host_key not in self.circuit_breakers:
            self.circuit_breakers[host_key] = CircuitBreakerState(self.circuit_breaker_config)
        return self.circuit_breakers[host_key]
    
    async def _ensure_session(self):
        """Ensure session is available and not too old."""
        if (
            not self.session 
            or self.session.closed 
            or (
                self.session_created_at 
                and datetime.now() - self.session_created_at > self.session_max_age
            )
        ):
            if self.session and not self.session.closed:
                await self.session.close()
            
            await self.initialize()
    
    async def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay for retry with exponential backoff and jitter."""
        delay = min(
            self.retry_config.base_delay * (self.retry_config.exponential_base ** attempt),
            self.retry_config.max_delay
        )
        
        if self.retry_config.jitter:
            import random
            delay *= (0.5 + random.random() * 0.5)  # Add 0-50% jitter
        
        return delay
    
    async def request(
        self,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        data: Optional[Union[str, bytes]] = None,
        params: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
        retry_override: Optional[RetryConfig] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Make HTTP request with connection pooling, retries, and circuit breaker.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            url: Request URL
            headers: Optional headers dict
            json_data: Optional JSON payload
            data: Optional raw data payload
            params: Optional URL parameters
            timeout: Optional timeout override
            retry_override: Optional retry configuration override
            
        Returns:
            Response data as dict or None if failed
        """
        await self._ensure_session()
        
        if not self.session:
            logger.error("HTTP session not available")
            return None
        
        host_key = self._get_host_key(url)
        circuit_breaker = self._get_circuit_breaker(host_key)
        retry_config = retry_override or self.retry_config
        
        # Check circuit breaker
        if not circuit_breaker.can_execute():
            logger.warning(f"Circuit breaker OPEN for {host_key}")
            return None
        
        start_time = time.time()
        last_exception = None
        retried = False
        
        for attempt in range(retry_config.max_retries + 1):
            try:
                # Apply custom timeout if provided
                request_timeout = None
                if timeout:
                    request_timeout = ClientTimeout(total=timeout)
                
                # Make the request
                async with self.session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=json_data,
                    data=data,
                    params=params,
                    timeout=request_timeout,
                ) as response:
                    
                    # Check if response status indicates retry
                    if response.status in retry_config.retry_on_status and attempt < retry_config.max_retries:
                        retried = True
                        delay = await self._calculate_delay(attempt)
                        logger.warning(f"Request failed with status {response.status}, retrying in {delay:.2f}s")
                        await asyncio.sleep(delay)
                        continue
                    
                    # Raise for HTTP error status
                    response.raise_for_status()
                    
                    # Parse response
                    try:
                        result = await response.json()
                    except Exception:
                        # Fallback to text if JSON parsing fails
                        result = {"text": await response.text(), "status": response.status}
                    
                    # Record success
                    response_time = time.time() - start_time
                    circuit_breaker.record_success()
                    self.metrics.record_request(host_key, True, response_time, retried)
                    
                    return result
            
            except (ClientError, asyncio.TimeoutError) as e:
                last_exception = e
                
                if attempt < retry_config.max_retries:
                    retried = True
                    delay = await self._calculate_delay(attempt)
                    logger.warning(f"Request failed: {e}, retrying in {delay:.2f}s")
                    await asyncio.sleep(delay)
                    continue
                else:
                    break
        
        # All retries failed
        response_time = time.time() - start_time
        circuit_breaker.record_failure()
        self.metrics.record_request(host_key, False, response_time, retried)
        
        logger.error(f"Request failed after {retry_config.max_retries + 1} attempts: {last_exception}")
        return None
    
    async def get(self, url: str, **kwargs) -> Optional[Dict[str, Any]]:
        """Make GET request."""
        return await self.request("GET", url, **kwargs)
    
    async def post(self, url: str, **kwargs) -> Optional[Dict[str, Any]]:
        """Make POST request."""
        return await self.request("POST", url, **kwargs)
    
    async def put(self, url: str, **kwargs) -> Optional[Dict[str, Any]]:
        """Make PUT request."""
        return await self.request("PUT", url, **kwargs)
    
    async def delete(self, url: str, **kwargs) -> Optional[Dict[str, Any]]:
        """Make DELETE request."""
        return await self.request("DELETE", url, **kwargs)
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get HTTP client performance metrics."""
        base_stats = self.metrics.get_stats()
        
        # Add circuit breaker information
        circuit_breaker_stats = {}
        for host, cb in self.circuit_breakers.items():
            circuit_breaker_stats[host] = {
                "state": cb.state,
                "failure_count": cb.failure_count,
                "last_failure": cb.last_failure_time.isoformat() if cb.last_failure_time else None,
            }
        
        # Add connection pool information
        pool_stats = {}
        if self.connector:
            pool_stats = {
                "total_connections": len(self.connector._conns),
                "available_connections": sum(len(conns) for conns in self.connector._conns.values()),
                "limit": self.connector.limit,
                "limit_per_host": self.connector.limit_per_host,
            }
        
        return {
            **base_stats,
            "circuit_breakers": circuit_breaker_stats,
            "connection_pool": pool_stats,
            "session_age": (
                (datetime.now() - self.session_created_at).total_seconds()
                if self.session_created_at else 0
            ),
        }


# Global HTTP client service instance
_http_client_service: Optional[HTTPClientService] = None


def get_http_client_service() -> HTTPClientService:
    """Get the global HTTP client service instance."""
    global _http_client_service
    if _http_client_service is None:
        _http_client_service = HTTPClientService()
    return _http_client_service


async def initialize_http_client() -> bool:
    """Initialize the global HTTP client service."""
    client = get_http_client_service()
    return await client.initialize()


async def cleanup_http_client():
    """Cleanup the global HTTP client service."""
    global _http_client_service
    if _http_client_service:
        await _http_client_service.close()
        _http_client_service = None