"""
Enhanced HTTP Client for MCP Services
=====================================

High-performance HTTP client optimized for MCP (Model Context Protocol) service communication.
Provides connection pooling, circuit breaker patterns, and advanced retry logic specifically
tuned for internal microservice communication.

Features:
- Optimized connection pooling for MCP service patterns
- Circuit breaker with rapid recovery for internal services
- Custom retry logic for different MCP operation types
- Performance monitoring and health metrics
- Automatic request/response logging for debugging
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union
from urllib.parse import urljoin, urlparse

import aiohttp
from aiohttp import ClientSession, ClientTimeout, TCPConnector
from aiohttp.client_exceptions import ClientError, ClientResponseError

from .http_client_service import HTTPClientService, ConnectionPoolConfig, RetryConfig, CircuitBreakerConfig

logger = logging.getLogger(__name__)


class MCPConnectionPoolConfig(ConnectionPoolConfig):
    """Optimized connection pool configuration for MCP services."""
    
    def __init__(self):
        super().__init__(
            max_connections=100,              # Beta requirement
            max_connections_per_host=20,      # Beta requirement  
            connection_timeout=5.0,           # Fast internal connections
            read_timeout=30.0,                # MCP operations can be slow
            total_timeout=60.0,               # Allow for complex operations
            keepalive_timeout=20.0,           # Beta requirement
            enable_cleanup_closed=True,       # Clean connections
            connector_limit=100,              # Match max_connections
            connector_limit_per_host=30,      # Higher for internal services
        )


class MCPRetryConfig(RetryConfig):
    """Retry configuration optimized for MCP service communication."""
    
    def __init__(self):
        super().__init__(
            max_retries=3,                    # Quick retries for internal services
            base_delay=0.5,                   # Faster initial retry
            max_delay=10.0,                   # Shorter max delay for internal
            exponential_base=1.5,             # Gentler backoff for internal
            jitter=True,                      # Prevent thundering herd
            retry_on_status={408, 429, 502, 503, 504}  # Standard retry statuses
        )


class MCPCircuitBreakerConfig(CircuitBreakerConfig):
    """Circuit breaker configuration optimized for MCP services."""
    
    def __init__(self):
        super().__init__(
            failure_threshold=3,              # Lower threshold for internal services
            recovery_timeout=30.0,            # Faster recovery for internal services
            expected_exception=ClientError,   # Standard aiohttp exceptions
        )


class MCPRequestType:
    """MCP-specific request type classifications for optimized handling."""
    
    RAG_QUERY = "rag_query"               # Search and retrieval operations
    PROJECT_MANAGEMENT = "project_mgmt"   # Project and task operations
    DOCUMENT_STORAGE = "doc_storage"      # Document upload and storage
    HEALTH_CHECK = "health_check"         # Service health monitoring
    CRAWLING = "crawling"                 # Web crawling operations
    
    # Timeout configurations by request type
    TIMEOUTS = {
        RAG_QUERY: ClientTimeout(total=30.0, connect=3.0, sock_read=20.0),
        PROJECT_MANAGEMENT: ClientTimeout(total=15.0, connect=3.0, sock_read=10.0),
        DOCUMENT_STORAGE: ClientTimeout(total=120.0, connect=5.0, sock_read=90.0),
        HEALTH_CHECK: ClientTimeout(total=5.0, connect=2.0, sock_read=3.0),
        CRAWLING: ClientTimeout(total=300.0, connect=10.0, sock_read=250.0),
    }


class MCPHTTPClient(HTTPClientService):
    """
    Enhanced HTTP client service specifically optimized for MCP communication.
    
    Extends the base HTTPClientService with MCP-specific optimizations:
    - Request type-based timeout configuration
    - MCP service endpoint mapping
    - Enhanced logging for MCP operations
    - Performance metrics for different MCP operation types
    """
    
    def __init__(self):
        super().__init__(
            pool_config=MCPConnectionPoolConfig(),
            retry_config=MCPRetryConfig(),
            circuit_breaker_config=MCPCircuitBreakerConfig(),
        )
        
        # MCP-specific metrics
        self.mcp_metrics = {
            "requests_by_type": {},
            "response_times_by_type": {},
            "errors_by_type": {},
            "circuit_breaker_triggers": {},
        }
        
        # Service endpoint mapping
        self.service_endpoints = {
            "api": None,      # Will be set from environment
            "agents": None,   # Will be set from environment
            "mcp": None,      # Will be set from environment
        }
    
    def set_service_endpoints(self, api_url: str, agents_url: str, mcp_url: str = None):
        """Configure service endpoint URLs."""
        self.service_endpoints["api"] = api_url.rstrip('/')
        self.service_endpoints["agents"] = agents_url.rstrip('/')
        if mcp_url:
            self.service_endpoints["mcp"] = mcp_url.rstrip('/')
    
    def _get_request_timeout(self, request_type: str) -> ClientTimeout:
        """Get optimized timeout configuration for specific MCP request types."""
        return MCPRequestType.TIMEOUTS.get(
            request_type, 
            ClientTimeout(total=30.0, connect=5.0, sock_read=20.0)
        )
    
    def _record_mcp_metrics(
        self, 
        request_type: str, 
        success: bool, 
        response_time: float, 
        error_type: str = None
    ):
        """Record MCP-specific performance metrics."""
        # Request count by type
        if request_type not in self.mcp_metrics["requests_by_type"]:
            self.mcp_metrics["requests_by_type"][request_type] = {"success": 0, "failure": 0}
        
        if success:
            self.mcp_metrics["requests_by_type"][request_type]["success"] += 1
        else:
            self.mcp_metrics["requests_by_type"][request_type]["failure"] += 1
        
        # Response times by type
        if request_type not in self.mcp_metrics["response_times_by_type"]:
            self.mcp_metrics["response_times_by_type"][request_type] = []
        
        self.mcp_metrics["response_times_by_type"][request_type].append(response_time)
        
        # Keep only last 100 response times per type
        if len(self.mcp_metrics["response_times_by_type"][request_type]) > 100:
            self.mcp_metrics["response_times_by_type"][request_type] = \
                self.mcp_metrics["response_times_by_type"][request_type][-100:]
        
        # Error tracking
        if not success and error_type:
            if request_type not in self.mcp_metrics["errors_by_type"]:
                self.mcp_metrics["errors_by_type"][request_type] = {}
            
            if error_type not in self.mcp_metrics["errors_by_type"][request_type]:
                self.mcp_metrics["errors_by_type"][request_type][error_type] = 0
            
            self.mcp_metrics["errors_by_type"][request_type][error_type] += 1
    
    async def mcp_request(
        self,
        method: str,
        service: str,
        endpoint: str,
        request_type: str = MCPRequestType.RAG_QUERY,
        headers: Optional[Dict[str, str]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        data: Optional[Union[str, bytes]] = None,
        params: Optional[Dict[str, str]] = None,
        custom_timeout: Optional[float] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Make MCP service request with optimized configuration.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            service: Target service name ('api', 'agents', 'mcp')
            endpoint: Service endpoint path (e.g., '/api/rag/query')
            request_type: MCP request type for optimization
            headers: Optional request headers
            json_data: Optional JSON payload
            data: Optional raw data payload
            params: Optional URL parameters
            custom_timeout: Optional timeout override
            
        Returns:
            Response data as dict or None if failed
        """
        # Build full URL
        if service not in self.service_endpoints or not self.service_endpoints[service]:
            logger.error(f"Service endpoint not configured: {service}")
            return None
        
        base_url = self.service_endpoints[service]
        url = urljoin(base_url, endpoint)
        
        # Get request type-specific timeout
        if custom_timeout:
            timeout = custom_timeout
        else:
            timeout_config = self._get_request_timeout(request_type)
            timeout = timeout_config.total
        
        # Add MCP-specific headers
        mcp_headers = {
            "User-Agent": "Archon-MCP-Client/2.0",
            "X-Request-Type": request_type,
            "X-Service-Source": "mcp",
            **(headers or {})
        }
        
        start_time = time.time()
        logger.debug(f"MCP {method} {url} (type: {request_type})")
        
        try:
            # Make request using parent class method
            result = await self.request(
                method=method,
                url=url,
                headers=mcp_headers,
                json_data=json_data,
                data=data,
                params=params,
                timeout=timeout,
            )
            
            response_time = time.time() - start_time
            self._record_mcp_metrics(request_type, True, response_time)
            
            logger.debug(f"MCP {method} {url} completed in {response_time:.3f}s")
            return result
        
        except Exception as e:
            response_time = time.time() - start_time
            error_type = type(e).__name__
            self._record_mcp_metrics(request_type, False, response_time, error_type)
            
            logger.error(f"MCP {method} {url} failed after {response_time:.3f}s: {e}")
            return None
    
    async def rag_query(
        self,
        query: str,
        source_filter: str = None,
        match_count: int = 5,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """Optimized RAG query request."""
        return await self.mcp_request(
            method="POST",
            service="api",
            endpoint="/api/rag/query",
            request_type=MCPRequestType.RAG_QUERY,
            json_data={
                "query": query,
                "source": source_filter,
                "match_count": match_count,
                **kwargs
            }
        )
    
    async def search_code_examples(
        self,
        query: str,
        source_id: str = None,
        match_count: int = 3,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """Optimized code example search request."""
        return await self.mcp_request(
            method="GET",
            service="api",
            endpoint="/api/knowledge/code-examples",
            request_type=MCPRequestType.RAG_QUERY,
            params={
                "query": query,
                "source_id": source_id,
                "match_count": str(match_count),
                **{k: str(v) for k, v in kwargs.items()}
            }
        )
    
    async def create_project(
        self,
        title: str,
        description: str = None,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """Optimized project creation request."""
        return await self.mcp_request(
            method="POST",
            service="api",
            endpoint="/api/projects",
            request_type=MCPRequestType.PROJECT_MANAGEMENT,
            json_data={
                "title": title,
                "description": description,
                **kwargs
            }
        )
    
    async def manage_task(
        self,
        action: str,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """Optimized task management request."""
        return await self.mcp_request(
            method="POST",
            service="api",
            endpoint=f"/api/tasks/{action}",
            request_type=MCPRequestType.PROJECT_MANAGEMENT,
            json_data=kwargs
        )
    
    async def health_check(self, service: str = None) -> Optional[Dict[str, Any]]:
        """Optimized health check request."""
        if service:
            endpoint = "/health"
        else:
            service = "api"
            endpoint = "/api/health"
        
        return await self.mcp_request(
            method="GET",
            service=service,
            endpoint=endpoint,
            request_type=MCPRequestType.HEALTH_CHECK,
        )
    
    def get_mcp_metrics(self) -> Dict[str, Any]:
        """Get comprehensive MCP performance metrics."""
        base_metrics = self.get_metrics()
        
        # Calculate MCP-specific statistics
        type_stats = {}
        for request_type, times in self.mcp_metrics["response_times_by_type"].items():
            if times:
                counts = self.mcp_metrics["requests_by_type"].get(request_type, {})
                type_stats[request_type] = {
                    "total_requests": counts.get("success", 0) + counts.get("failure", 0),
                    "successful_requests": counts.get("success", 0),
                    "failed_requests": counts.get("failure", 0),
                    "success_rate": (
                        counts.get("success", 0) / 
                        (counts.get("success", 0) + counts.get("failure", 0)) * 100
                        if (counts.get("success", 0) + counts.get("failure", 0)) > 0 else 0
                    ),
                    "avg_response_time": sum(times) / len(times),
                    "min_response_time": min(times),
                    "max_response_time": max(times),
                    "recent_errors": self.mcp_metrics["errors_by_type"].get(request_type, {}),
                }
        
        return {
            **base_metrics,
            "mcp_request_types": type_stats,
            "service_endpoints": self.service_endpoints,
            "optimization_config": {
                "connection_pool": "MCP-optimized",
                "circuit_breaker": "Fast recovery",
                "retry_strategy": "Internal service optimized",
            }
        }


# Global MCP HTTP client instance
_mcp_http_client: Optional[MCPHTTPClient] = None


def get_mcp_http_client() -> MCPHTTPClient:
    """Get the global MCP HTTP client instance."""
    global _mcp_http_client
    if _mcp_http_client is None:
        _mcp_http_client = MCPHTTPClient()
    return _mcp_http_client


async def initialize_mcp_http_client(
    api_url: str, 
    agents_url: str, 
    mcp_url: str = None
) -> bool:
    """Initialize the global MCP HTTP client with service endpoints."""
    client = get_mcp_http_client()
    client.set_service_endpoints(api_url, agents_url, mcp_url)
    return await client.initialize()


async def cleanup_mcp_http_client():
    """Cleanup the global MCP HTTP client."""
    global _mcp_http_client
    if _mcp_http_client:
        await _mcp_http_client.close()
        _mcp_http_client = None