"""
HTTP Client with Correlation ID Propagation

Enhanced HTTP client for microservices communication with:
- Automatic correlation ID propagation
- Connection pooling and circuit breaker patterns
- Request/response logging with performance metrics
- Retry logic with exponential backoff
"""

import asyncio
import time
from typing import Dict, Any, Optional, Union, List
from urllib.parse import urljoin
import aiohttp
from aiohttp import ClientSession, ClientTimeout, TCPConnector, ClientError

from src.server.logging.structured_logger import (
    get_logger,
    get_correlation_id,
    alog_performance
)
from src.server.middleware.correlation_middleware import (
    CORRELATION_ID_HEADER,
    REQUEST_ID_HEADER,
    USER_ID_HEADER
)

logger = get_logger(__name__)


class CircuitBreakerError(Exception):
    """Exception raised when circuit breaker is open"""
    pass


class CircuitBreaker:
    """Circuit breaker implementation for service resilience"""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        timeout: float = 60.0,
        expected_exception: type = ClientError
    ):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.expected_exception = expected_exception
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    def can_execute(self) -> bool:
        """Check if request can be executed"""
        if self.state == "CLOSED":
            return True
        
        if self.state == "OPEN":
            if time.time() - self.last_failure_time >= self.timeout:
                self.state = "HALF_OPEN"
                return True
            return False
        
        # HALF_OPEN state
        return True
    
    def on_success(self):
        """Record successful execution"""
        self.failure_count = 0
        self.state = "CLOSED"
    
    def on_failure(self):
        """Record failed execution"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(
                "Circuit breaker opened",
                failure_count=self.failure_count,
                threshold=self.failure_threshold
            )


class TracingHTTPClient:
    """HTTP client with distributed tracing and correlation ID propagation"""
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
        max_connections: int = 100,
        max_connections_per_host: int = 20,
        enable_circuit_breaker: bool = True,
        retry_attempts: int = 3,
        retry_backoff_factor: float = 0.5
    ):
        self.base_url = base_url
        self.timeout = ClientTimeout(total=timeout)
        self.max_connections = max_connections
        self.max_connections_per_host = max_connections_per_host
        self.retry_attempts = retry_attempts
        self.retry_backoff_factor = retry_backoff_factor
        
        # Circuit breaker for each host
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.enable_circuit_breaker = enable_circuit_breaker
        
        # HTTP session (will be created lazily)
        self._session: Optional[ClientSession] = None
    
    async def _get_session(self) -> ClientSession:
        """Get or create HTTP session with connection pooling"""
        if self._session is None or self._session.closed:
            connector = TCPConnector(
                limit=self.max_connections,
                limit_per_host=self.max_connections_per_host,
                ttl_dns_cache=300,  # 5 minutes DNS cache
                use_dns_cache=True,
                keepalive_timeout=30
            )
            
            self._session = ClientSession(
                connector=connector,
                timeout=self.timeout,
                headers=self._get_default_headers()
            )
            
            logger.info(
                "HTTP session created",
                max_connections=self.max_connections,
                max_connections_per_host=self.max_connections_per_host,
                timeout=self.timeout.total
            )
        
        return self._session
    
    def _get_default_headers(self) -> Dict[str, str]:
        """Get default headers including correlation ID"""
        headers = {
            "User-Agent": "Archon-API/2.0.0-beta",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        # Add correlation ID if available
        correlation_id = get_correlation_id()
        if correlation_id:
            headers[CORRELATION_ID_HEADER] = correlation_id
            headers[REQUEST_ID_HEADER] = correlation_id
        
        return headers
    
    def _get_circuit_breaker(self, host: str) -> CircuitBreaker:
        """Get or create circuit breaker for host"""
        if host not in self.circuit_breakers:
            self.circuit_breakers[host] = CircuitBreaker()
        return self.circuit_breakers[host]
    
    def _build_url(self, endpoint: str) -> str:
        """Build full URL from endpoint"""
        if endpoint.startswith(("http://", "https://")):
            return endpoint
        
        if self.base_url:
            return urljoin(self.base_url.rstrip("/") + "/", endpoint.lstrip("/"))
        
        return endpoint
    
    @alog_performance("http_request")
    async def request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        data: Optional[Union[str, bytes]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Make HTTP request with correlation ID propagation and retry logic"""
        
        url = self._build_url(endpoint)
        session = await self._get_session()
        
        # Merge headers
        request_headers = self._get_default_headers()
        if headers:
            request_headers.update(headers)
        
        # Get circuit breaker for this host
        host = url.split("/")[2] if "//" in url else "unknown"
        circuit_breaker = self._get_circuit_breaker(host)
        
        # Check circuit breaker
        if self.enable_circuit_breaker and not circuit_breaker.can_execute():
            raise CircuitBreakerError(f"Circuit breaker is open for {host}")
        
        # Prepare request parameters
        request_params = {
            "params": params,
            "headers": request_headers,
            "timeout": ClientTimeout(total=timeout) if timeout else None,
            **kwargs
        }
        
        if json_data is not None:
            request_params["json"] = json_data
        elif data is not None:
            request_params["data"] = data
        
        # Retry logic
        last_exception = None
        for attempt in range(self.retry_attempts + 1):
            start_time = time.time()
            
            try:
                logger.debug(
                    "Making HTTP request",
                    method=method,
                    url=url,
                    attempt=attempt + 1,
                    has_json=json_data is not None,
                    has_data=data is not None,
                    headers_count=len(request_headers)
                )
                
                async with session.request(method, url, **request_params) as response:
                    duration_ms = (time.time() - start_time) * 1000
                    
                    # Read response
                    response_text = await response.text()
                    
                    # Log external service call
                    logger.external_service(
                        service=host,
                        endpoint=endpoint,
                        status_code=response.status,
                        duration_ms=duration_ms,
                        attempt=attempt + 1,
                        response_size=len(response_text)
                    )
                    
                    # Handle response based on status code
                    if response.status >= 400:
                        error_details = {
                            "status": response.status,
                            "url": url,
                            "method": method,
                            "response": response_text[:500]  # Limit response text
                        }
                        
                        # Record failure for circuit breaker
                        if self.enable_circuit_breaker:
                            circuit_breaker.on_failure()
                        
                        # Retry on 5xx errors
                        if 500 <= response.status < 600 and attempt < self.retry_attempts:
                            logger.warning(
                                "HTTP request failed, retrying",
                                **error_details,
                                attempt=attempt + 1,
                                max_attempts=self.retry_attempts
                            )
                            
                            # Exponential backoff
                            backoff_time = self.retry_backoff_factor * (2 ** attempt)
                            await asyncio.sleep(backoff_time)
                            continue
                        
                        # Don't retry on 4xx errors
                        logger.error(
                            "HTTP request failed",
                            **error_details
                        )
                        
                        response.raise_for_status()
                    
                    # Success
                    if self.enable_circuit_breaker:
                        circuit_breaker.on_success()
                    
                    # Try to parse JSON response
                    try:
                        return await response.json()
                    except Exception:
                        # Return text if not JSON
                        return {"text": response_text, "status": response.status}
            
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                last_exception = e
                
                # Record failure for circuit breaker
                if self.enable_circuit_breaker:
                    circuit_breaker.on_failure()
                
                logger.error(
                    "HTTP request exception",
                    method=method,
                    url=url,
                    attempt=attempt + 1,
                    duration_ms=duration_ms,
                    error=e
                )
                
                # Retry on network errors
                if attempt < self.retry_attempts:
                    backoff_time = self.retry_backoff_factor * (2 ** attempt)
                    await asyncio.sleep(backoff_time)
                    continue
                
                # Re-raise after all retries exhausted
                break
        
        # All retries exhausted
        if last_exception:
            raise last_exception
    
    async def get(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make GET request"""
        return await self.request("GET", endpoint, **kwargs)
    
    async def post(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make POST request"""
        return await self.request("POST", endpoint, **kwargs)
    
    async def put(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make PUT request"""
        return await self.request("PUT", endpoint, **kwargs)
    
    async def delete(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make DELETE request"""
        return await self.request("DELETE", endpoint, **kwargs)
    
    async def patch(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make PATCH request"""
        return await self.request("PATCH", endpoint, **kwargs)
    
    async def close(self):
        """Close HTTP session"""
        if self._session and not self._session.closed:
            await self._session.close()
            logger.info("HTTP session closed")
    
    async def __aenter__(self):
        """Async context manager entry"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()


# Service-specific HTTP clients
class MCPServiceClient(TracingHTTPClient):
    """HTTP client specifically for MCP service communication"""
    
    def __init__(self, mcp_base_url: str = "http://localhost:8051"):
        super().__init__(
            base_url=mcp_base_url,
            timeout=30.0,
            retry_attempts=2,
            enable_circuit_breaker=True
        )
    
    async def health_check(self) -> Dict[str, Any]:
        """Check MCP service health"""
        return await self.get("/health")
    
    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute MCP tool"""
        return await self.post(f"/tools/{tool_name}", json_data={"arguments": arguments})
    
    async def list_tools(self) -> Dict[str, Any]:
        """List available MCP tools"""
        return await self.get("/tools")


class AgentsServiceClient(TracingHTTPClient):
    """HTTP client for Agents service communication"""
    
    def __init__(self, agents_base_url: str = "http://localhost:8052"):
        super().__init__(
            base_url=agents_base_url,
            timeout=60.0,  # Longer timeout for AI operations
            retry_attempts=1,  # Don't retry AI operations
            enable_circuit_breaker=True
        )
    
    async def generate_embedding(self, text: str, model: str = "text-embedding-ada-002") -> Dict[str, Any]:
        """Generate text embedding"""
        return await self.post("/embeddings", json_data={"text": text, "model": model})
    
    async def analyze_document(self, document_content: str) -> Dict[str, Any]:
        """Analyze document content"""
        return await self.post("/analyze", json_data={"content": document_content})


# Global HTTP client instances
_default_client: Optional[TracingHTTPClient] = None
_mcp_client: Optional[MCPServiceClient] = None
_agents_client: Optional[AgentsServiceClient] = None


async def get_default_client() -> TracingHTTPClient:
    """Get default HTTP client instance"""
    global _default_client
    if _default_client is None:
        _default_client = TracingHTTPClient()
    return _default_client


async def get_mcp_client() -> MCPServiceClient:
    """Get MCP service client instance"""
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = MCPServiceClient()
    return _mcp_client


async def get_agents_client() -> AgentsServiceClient:
    """Get Agents service client instance"""
    global _agents_client
    if _agents_client is None:
        _agents_client = AgentsServiceClient()
    return _agents_client


async def close_all_clients():
    """Close all HTTP client instances"""
    global _default_client, _mcp_client, _agents_client
    
    for client in [_default_client, _mcp_client, _agents_client]:
        if client:
            await client.close()
    
    _default_client = None
    _mcp_client = None
    _agents_client = None
    
    logger.info("All HTTP clients closed")


__all__ = [
    'TracingHTTPClient',
    'MCPServiceClient', 
    'AgentsServiceClient',
    'CircuitBreakerError',
    'get_default_client',
    'get_mcp_client',
    'get_agents_client',
    'close_all_clients'
]