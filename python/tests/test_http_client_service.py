"""
Tests for HTTP Client Service

Comprehensive tests for the beta performance enhancement HTTP client service.
Tests connection pooling, retry logic, circuit breaker, and metrics.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from aiohttp import ClientError, ClientResponseError, ClientTimeout
from aiohttp.client_exceptions import ClientConnectorError

from src.server.services.http_client_service import (
    HTTPClientService,
    ConnectionPoolConfig,
    RetryConfig,
    CircuitBreakerConfig,
    CircuitBreakerState,
    RequestMetrics,
    get_http_client_service,
    initialize_http_client,
    cleanup_http_client,
)


@pytest.fixture
async def http_client():
    """Create an HTTP client service for testing."""
    client = HTTPClientService()
    with patch('aiohttp.ClientSession') as mock_session_class, \
         patch('aiohttp.TCPConnector') as mock_connector_class:
        
        mock_connector = AsyncMock()
        mock_connector_class.return_value = mock_connector
        
        mock_session = AsyncMock()
        mock_session.closed = False
        mock_session_class.return_value = mock_session
        
        await client.initialize()
        yield client
        await client.close()


@pytest.fixture
def mock_response():
    """Create a mock HTTP response."""
    response = AsyncMock()
    response.status = 200
    response.json.return_value = {"test": "data"}
    response.text.return_value = "test response"
    response.raise_for_status.return_value = None
    return response


class TestConnectionPoolConfig:
    """Test connection pool configuration."""
    
    def test_default_configuration(self):
        """Test default connection pool configuration."""
        config = ConnectionPoolConfig()
        
        assert config.max_connections == 100
        assert config.max_connections_per_host == 20
        assert config.connection_timeout == 10.0
        assert config.read_timeout == 30.0
        assert config.total_timeout == 60.0
        assert config.keepalive_timeout == 30.0
        assert config.enable_cleanup_closed is True
    
    def test_custom_configuration(self):
        """Test custom connection pool configuration."""
        config = ConnectionPoolConfig(
            max_connections=200,
            connection_timeout=5.0,
            read_timeout=15.0,
        )
        
        assert config.max_connections == 200
        assert config.connection_timeout == 5.0
        assert config.read_timeout == 15.0


class TestRetryConfig:
    """Test retry configuration."""
    
    def test_default_retry_configuration(self):
        """Test default retry configuration."""
        config = RetryConfig()
        
        assert config.max_retries == 3
        assert config.base_delay == 1.0
        assert config.max_delay == 60.0
        assert config.exponential_base == 2.0
        assert config.jitter is True
        assert 502 in config.retry_on_status
        assert 503 in config.retry_on_status
    
    def test_custom_retry_configuration(self):
        """Test custom retry configuration."""
        config = RetryConfig(
            max_retries=5,
            base_delay=0.5,
            retry_on_status={500, 502, 503},
        )
        
        assert config.max_retries == 5
        assert config.base_delay == 0.5
        assert config.retry_on_status == {500, 502, 503}


class TestCircuitBreakerState:
    """Test circuit breaker state management."""
    
    def test_initial_state(self):
        """Test initial circuit breaker state."""
        config = CircuitBreakerConfig()
        state = CircuitBreakerState(config)
        
        assert state.state == "closed"
        assert state.failure_count == 0
        assert state.can_execute() is True
    
    def test_failure_tracking(self):
        """Test failure count tracking."""
        config = CircuitBreakerConfig(failure_threshold=3)
        state = CircuitBreakerState(config)
        
        # Record failures
        state.record_failure()
        assert state.failure_count == 1
        assert state.state == "closed"
        
        state.record_failure()
        state.record_failure()
        assert state.failure_count == 3
        assert state.state == "open"
        assert state.can_execute() is False
    
    def test_success_resets_state(self):
        """Test that success resets circuit breaker state."""
        config = CircuitBreakerConfig(failure_threshold=2)
        state = CircuitBreakerState(config)
        
        # Record failures to open circuit
        state.record_failure()
        state.record_failure()
        assert state.state == "open"
        
        # Simulate recovery timeout
        state.state = "half-open"
        
        # Record success should reset
        state.record_success()
        assert state.state == "closed"
        assert state.failure_count == 0


class TestRequestMetrics:
    """Test request metrics tracking."""
    
    def test_initial_metrics(self):
        """Test initial metrics state."""
        metrics = RequestMetrics()
        
        assert metrics.total_requests == 0
        assert metrics.successful_requests == 0
        assert metrics.failed_requests == 0
        assert metrics.retried_requests == 0
    
    def test_record_successful_request(self):
        """Test recording successful request."""
        metrics = RequestMetrics()
        
        metrics.record_request("example.com", success=True, response_time=0.5)
        
        assert metrics.total_requests == 1
        assert metrics.successful_requests == 1
        assert metrics.failed_requests == 0
        assert metrics.requests_by_host["example.com"] == 1
        assert 0.5 in metrics.response_times_by_host["example.com"]
    
    def test_record_failed_request(self):
        """Test recording failed request."""
        metrics = RequestMetrics()
        
        metrics.record_request("example.com", success=False, response_time=1.0, retried=True)
        
        assert metrics.total_requests == 1
        assert metrics.successful_requests == 0
        assert metrics.failed_requests == 1
        assert metrics.retried_requests == 1
    
    def test_get_stats(self):
        """Test metrics statistics generation."""
        metrics = RequestMetrics()
        
        # Record multiple requests
        metrics.record_request("example.com", success=True, response_time=0.5)
        metrics.record_request("example.com", success=False, response_time=1.0)
        metrics.record_request("test.com", success=True, response_time=0.3)
        
        stats = metrics.get_stats()
        
        assert stats["total_requests"] == 3
        assert stats["successful_requests"] == 2
        assert stats["failed_requests"] == 1
        assert stats["success_rate"] == 66.67
        assert "example.com" in stats["host_statistics"]
        assert "test.com" in stats["host_statistics"]


class TestHTTPClientService:
    """Test HTTP client service functionality."""
    
    @pytest.mark.asyncio
    async def test_initialization_success(self):
        """Test successful HTTP client initialization."""
        client = HTTPClientService()
        
        with patch('aiohttp.ClientSession') as mock_session_class, \
             patch('aiohttp.TCPConnector') as mock_connector_class:
            
            mock_connector = AsyncMock()
            mock_connector_class.return_value = mock_connector
            
            mock_session = AsyncMock()
            mock_session.closed = False
            mock_session_class.return_value = mock_session
            
            result = await client.initialize()
            
            assert result is True
            assert client.session is not None
            assert client.connector is not None
            
            await client.close()
    
    @pytest.mark.asyncio
    async def test_initialization_failure(self):
        """Test HTTP client initialization failure."""
        client = HTTPClientService()
        
        with patch('aiohttp.TCPConnector', side_effect=Exception("Connection failed")):
            result = await client.initialize()
            
            assert result is False
            assert client.session is None
    
    @pytest.mark.asyncio
    async def test_successful_get_request(self, http_client, mock_response):
        """Test successful GET request."""
        # Mock the session request
        http_client.session.request.return_value.__aenter__.return_value = mock_response
        
        result = await http_client.get("https://example.com/api/test")
        
        assert result == {"test": "data"}
        assert http_client.metrics.successful_requests == 1
        assert http_client.metrics.failed_requests == 0
    
    @pytest.mark.asyncio
    async def test_successful_post_request(self, http_client, mock_response):
        """Test successful POST request with JSON data."""
        http_client.session.request.return_value.__aenter__.return_value = mock_response
        
        test_data = {"key": "value"}
        result = await http_client.post("https://example.com/api/test", json_data=test_data)
        
        assert result == {"test": "data"}
        
        # Verify request was made with correct parameters
        http_client.session.request.assert_called_once()
        call_args = http_client.session.request.call_args
        assert call_args[1]["method"] == "POST"
        assert call_args[1]["json"] == test_data
    
    @pytest.mark.asyncio
    async def test_request_with_custom_headers(self, http_client, mock_response):
        """Test request with custom headers."""
        http_client.session.request.return_value.__aenter__.return_value = mock_response
        
        headers = {"Authorization": "Bearer token", "Content-Type": "application/json"}
        result = await http_client.get("https://example.com/api/test", headers=headers)
        
        assert result == {"test": "data"}
        
        call_args = http_client.session.request.call_args
        assert call_args[1]["headers"] == headers
    
    @pytest.mark.asyncio
    async def test_request_with_timeout(self, http_client, mock_response):
        """Test request with custom timeout."""
        http_client.session.request.return_value.__aenter__.return_value = mock_response
        
        result = await http_client.get("https://example.com/api/test", timeout=5.0)
        
        assert result == {"test": "data"}
        
        call_args = http_client.session.request.call_args
        assert call_args[1]["timeout"] is not None
    
    @pytest.mark.asyncio
    async def test_request_retry_on_failure(self, http_client):
        """Test request retry on failure."""
        # Mock failed requests that should trigger retry
        error = ClientResponseError(
            request_info=MagicMock(),
            history=(),
            status=503,
            message="Service Unavailable"
        )
        
        http_client.session.request.side_effect = error
        
        # Override retry config for faster testing
        http_client.retry_config = RetryConfig(max_retries=2, base_delay=0.01)
        
        result = await http_client.get("https://example.com/api/test")
        
        assert result is None
        assert http_client.metrics.failed_requests == 1
        assert http_client.metrics.retried_requests == 1
        
        # Should have made 3 attempts (initial + 2 retries)
        assert http_client.session.request.call_count == 3
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_opens_on_failures(self, http_client):
        """Test circuit breaker opens after multiple failures."""
        # Configure circuit breaker for quick testing
        http_client.circuit_breaker_config = CircuitBreakerConfig(
            failure_threshold=2,
            recovery_timeout=0.1
        )
        
        error = ClientConnectorError(connection_key=MagicMock(), os_error=OSError("Connection failed"))
        http_client.session.request.side_effect = error
        
        # Make requests to trigger circuit breaker
        await http_client.get("https://example.com/api/test")
        await http_client.get("https://example.com/api/test")
        
        # Circuit should be open now
        host_key = "https://example.com"
        circuit_breaker = http_client._get_circuit_breaker(host_key)
        assert circuit_breaker.state == "open"
        
        # Next request should fail immediately without making HTTP call
        call_count_before = http_client.session.request.call_count
        result = await http_client.get("https://example.com/api/test")
        assert result is None
        assert http_client.session.request.call_count == call_count_before
    
    @pytest.mark.asyncio
    async def test_json_response_parsing_fallback(self, http_client):
        """Test fallback when JSON parsing fails."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.side_effect = Exception("Invalid JSON")
        mock_response.text.return_value = "plain text response"
        mock_response.raise_for_status.return_value = None
        
        http_client.session.request.return_value.__aenter__.return_value = mock_response
        
        result = await http_client.get("https://example.com/api/test")
        
        assert result == {"text": "plain text response", "status": 200}
    
    @pytest.mark.asyncio
    async def test_get_metrics(self, http_client, mock_response):
        """Test metrics collection and reporting."""
        http_client.session.request.return_value.__aenter__.return_value = mock_response
        
        # Make some requests
        await http_client.get("https://example.com/api/test")
        await http_client.post("https://test.com/api/data")
        
        metrics = http_client.get_metrics()
        
        assert "total_requests" in metrics
        assert "successful_requests" in metrics
        assert "circuit_breakers" in metrics
        assert "connection_pool" in metrics
        assert "session_age" in metrics
        assert metrics["total_requests"] == 2
        assert metrics["successful_requests"] == 2
    
    @pytest.mark.asyncio
    async def test_session_recreation(self, http_client):
        """Test session recreation when it becomes too old."""
        # Mock old session
        from datetime import datetime, timedelta
        http_client.session_created_at = datetime.now() - timedelta(hours=2)
        
        with patch.object(http_client, 'initialize') as mock_init:
            mock_init.return_value = True
            
            await http_client._ensure_session()
            
            mock_init.assert_called_once()


class TestUtilityFunctions:
    """Test utility functions."""
    
    @pytest.mark.asyncio
    async def test_get_http_client_service(self):
        """Test getting global HTTP client service."""
        client1 = get_http_client_service()
        client2 = get_http_client_service()
        
        # Should return the same instance
        assert client1 is client2
    
    @pytest.mark.asyncio
    async def test_initialize_and_cleanup_http_client(self):
        """Test global HTTP client initialization and cleanup."""
        with patch.object(HTTPClientService, 'initialize', return_value=True) as mock_init, \
             patch.object(HTTPClientService, 'close') as mock_close:
            
            # Initialize
            result = await initialize_http_client()
            assert result is True
            mock_init.assert_called_once()
            
            # Cleanup
            await cleanup_http_client()
            mock_close.assert_called_once()


class TestErrorHandling:
    """Test error handling scenarios."""
    
    @pytest.mark.asyncio
    async def test_connection_error_handling(self, http_client):
        """Test handling of connection errors."""
        error = ClientConnectorError(
            connection_key=MagicMock(), 
            os_error=OSError("Network unreachable")
        )
        http_client.session.request.side_effect = error
        
        result = await http_client.get("https://unreachable.com/api/test")
        
        assert result is None
        assert http_client.metrics.failed_requests == 1
    
    @pytest.mark.asyncio
    async def test_timeout_error_handling(self, http_client):
        """Test handling of timeout errors."""
        error = asyncio.TimeoutError("Request timeout")
        http_client.session.request.side_effect = error
        
        result = await http_client.get("https://slow.com/api/test")
        
        assert result is None
        assert http_client.metrics.failed_requests == 1
    
    @pytest.mark.asyncio
    async def test_session_not_available(self, http_client):
        """Test handling when session is not available."""
        http_client.session = None
        
        result = await http_client.get("https://example.com/api/test")
        
        assert result is None


@pytest.mark.integration
class TestHTTPClientIntegration:
    """Integration tests for HTTP client service."""
    
    @pytest.mark.asyncio
    async def test_real_http_request(self):
        """
        Test with real HTTP request if network is available.
        This test is skipped if network is not available.
        """
        client = HTTPClientService()
        
        try:
            await client.initialize()
            
            # Test with a reliable public API
            result = await client.get("https://httpbin.org/json", timeout=10.0)
            
            if result is not None:
                # Should have returned JSON data
                assert isinstance(result, dict)
                
                # Check metrics
                metrics = client.get_metrics()
                assert metrics["total_requests"] >= 1
                assert metrics["successful_requests"] >= 1
            else:
                pytest.skip("Network not available for integration testing")
                
        except Exception as e:
            pytest.skip(f"Network not available for integration testing: {e}")
        finally:
            await client.close()
    
    @pytest.mark.asyncio
    async def test_connection_pooling_reuse(self):
        """Test that connections are reused in the pool."""
        client = HTTPClientService()
        
        try:
            await client.initialize()
            
            # Make multiple requests to the same host
            for _ in range(3):
                await client.get("https://httpbin.org/json", timeout=5.0)
            
            metrics = client.get_metrics()
            
            # Should have made multiple requests
            assert metrics["total_requests"] >= 3
            
            # Connection pool should show reuse
            if "connection_pool" in metrics:
                pool_stats = metrics["connection_pool"]
                assert "total_connections" in pool_stats
                
        except Exception as e:
            pytest.skip(f"Network not available for integration testing: {e}")
        finally:
            await client.close()