"""
Tests for Redis Cache Service

Comprehensive tests for the beta performance enhancement caching layer.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.server.services.cache_service import (
    CacheService,
    cached_operation,
    generate_cache_key,
    get_cache_service,
)


@pytest.fixture
async def cache_service():
    """Create a cache service instance for testing."""
    service = CacheService()
    # Mock Redis for testing
    with patch('redis.asyncio.Redis') as mock_redis:
        mock_client = AsyncMock()
        mock_redis.return_value = mock_client
        mock_client.ping.return_value = True
        
        # Mock connection pool
        with patch('redis.asyncio.ConnectionPool.from_url') as mock_pool:
            mock_pool.return_value = AsyncMock()
            await service.initialize()
            yield service
            await service.close()


@pytest.fixture
def mock_redis_client():
    """Create a mocked Redis client."""
    client = AsyncMock()
    client.ping.return_value = True
    client.get.return_value = None
    client.setex.return_value = True
    client.delete.return_value = 1
    client.keys.return_value = []
    client.flushdb.return_value = True
    client.info.return_value = {
        'connected_clients': 5,
        'used_memory_human': '1.5M',
        'keyspace_hits': 100,
        'keyspace_misses': 20,
        'total_commands_processed': 1000,
        'uptime_in_seconds': 3600
    }
    return client


class TestCacheService:
    """Test cases for CacheService class."""
    
    @pytest.mark.asyncio
    async def test_initialization_success(self):
        """Test successful Redis initialization."""
        service = CacheService()
        
        with patch('redis.asyncio.ConnectionPool.from_url') as mock_pool, \
             patch('redis.asyncio.Redis') as mock_redis:
            
            mock_client = AsyncMock()
            mock_client.ping.return_value = True
            mock_redis.return_value = mock_client
            mock_pool.return_value = AsyncMock()
            
            result = await service.initialize()
            
            assert result is True
            assert service.is_available is True
            assert service.redis_client is not None
    
    @pytest.mark.asyncio
    async def test_initialization_failure(self):
        """Test Redis initialization failure with graceful fallback."""
        service = CacheService()
        
        with patch('redis.asyncio.ConnectionPool.from_url', side_effect=Exception("Connection failed")):
            result = await service.initialize()
            
            assert result is False
            assert service.is_available is False
            assert service.redis_client is None
    
    @pytest.mark.asyncio
    async def test_cache_key_generation(self):
        """Test cache key generation with prefixes."""
        service = CacheService()
        
        key = service._get_cache_key("sources", "test_id")
        assert key == "src:test_id"
        
        key = service._get_cache_key("embeddings", "hash123")
        assert key == "emb:hash123"
    
    @pytest.mark.asyncio
    async def test_ttl_configuration(self):
        """Test TTL configuration for different categories."""
        service = CacheService()
        
        assert service._get_ttl("sources") == 3600  # 1 hour
        assert service._get_ttl("embeddings") == 86400  # 24 hours
        assert service._get_ttl("rag_queries") == 900  # 15 minutes
        assert service._get_ttl("unknown") == 1800  # default 30 minutes
    
    @pytest.mark.asyncio
    async def test_set_and_get_success(self, mock_redis_client):
        """Test successful cache set and get operations."""
        service = CacheService()
        service.redis_client = mock_redis_client
        service.is_available = True
        
        # Mock successful set
        mock_redis_client.setex.return_value = True
        
        # Test data
        test_data = {"key": "value", "number": 42}
        
        # Set cache
        result = await service.set("sources", "test_key", test_data)
        assert result is True
        
        # Verify setex was called with correct parameters
        mock_redis_client.setex.assert_called_once()
        call_args = mock_redis_client.setex.call_args
        assert call_args[0][0] == "src:test_key"  # cache key
        assert call_args[0][1] == 3600  # TTL for sources
        
        # Mock successful get
        import json
        mock_redis_client.get.return_value = json.dumps(test_data)
        
        # Get cache
        result = await service.get("sources", "test_key")
        assert result == test_data
    
    @pytest.mark.asyncio
    async def test_cache_miss(self, mock_redis_client):
        """Test cache miss scenario."""
        service = CacheService()
        service.redis_client = mock_redis_client
        service.is_available = True
        
        # Mock cache miss
        mock_redis_client.get.return_value = None
        
        result = await service.get("sources", "nonexistent_key")
        assert result is None
    
    @pytest.mark.asyncio
    async def test_cache_unavailable_fallback(self):
        """Test fallback when cache is unavailable."""
        service = CacheService()
        service.is_available = False
        service.redis_client = None
        
        # Set operation should return False
        result = await service.set("sources", "test_key", {"data": "value"})
        assert result is False
        
        # Get operation should return None
        result = await service.get("sources", "test_key")
        assert result is None
    
    @pytest.mark.asyncio
    async def test_delete_operation(self, mock_redis_client):
        """Test cache delete operation."""
        service = CacheService()
        service.redis_client = mock_redis_client
        service.is_available = True
        
        # Mock successful delete
        mock_redis_client.delete.return_value = 1
        
        result = await service.delete("sources", "test_key")
        assert result is True
        
        mock_redis_client.delete.assert_called_once_with("src:test_key")
    
    @pytest.mark.asyncio
    async def test_invalidate_pattern(self, mock_redis_client):
        """Test pattern-based cache invalidation."""
        service = CacheService()
        service.redis_client = mock_redis_client
        service.is_available = True
        
        # Mock keys and delete operations
        mock_redis_client.keys.return_value = ["src:test1", "src:test2", "src:test3"]
        mock_redis_client.delete.return_value = 3
        
        result = await service.invalidate_pattern("sources", "*test*")
        assert result == 3
        
        mock_redis_client.keys.assert_called_once_with("src:*test*")
        mock_redis_client.delete.assert_called_once_with("src:test1", "src:test2", "src:test3")
    
    @pytest.mark.asyncio
    async def test_clear_all(self, mock_redis_client):
        """Test clearing all cache entries."""
        service = CacheService()
        service.redis_client = mock_redis_client
        service.is_available = True
        
        # Mock successful flush
        mock_redis_client.flushdb.return_value = True
        
        result = await service.clear_all()
        assert result is True
        
        mock_redis_client.flushdb.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_stats(self, mock_redis_client):
        """Test cache statistics retrieval."""
        service = CacheService()
        service.redis_client = mock_redis_client
        service.is_available = True
        
        stats = await service.get_stats()
        
        assert stats["available"] is True
        assert stats["connected_clients"] == 5
        assert stats["used_memory"] == "1.5M"
        assert stats["hit_rate"] == 83.33  # 100/(100+20) * 100
        assert "total_commands_processed" in stats
    
    @pytest.mark.asyncio
    async def test_specialized_caching_methods(self, mock_redis_client):
        """Test specialized caching methods for common use cases."""
        service = CacheService()
        service.redis_client = mock_redis_client
        service.is_available = True
        
        # Mock successful operations
        mock_redis_client.setex.return_value = True
        mock_redis_client.get.return_value = '{"url": "test.com", "title": "Test"}'
        
        # Test source metadata caching
        metadata = {"url": "test.com", "title": "Test"}
        result = await service.cache_source_metadata("source123", metadata)
        assert result is True
        
        # Test source metadata retrieval
        result = await service.get_source_metadata("source123")
        assert result == metadata
        
        # Test embedding caching
        mock_redis_client.get.return_value = '[0.1, 0.2, 0.3]'
        embedding = [0.1, 0.2, 0.3]
        result = await service.cache_embedding_result("hash123", embedding)
        assert result is True
        
        result = await service.get_embedding_result("hash123")
        assert result == embedding


class TestCachedOperation:
    """Test cases for cached_operation utility function."""
    
    @pytest.mark.asyncio
    async def test_cached_operation_cache_hit(self):
        """Test cached operation with cache hit."""
        # Mock cache service
        mock_cache = AsyncMock()
        mock_cache.get.return_value = {"cached": "result"}
        
        # Mock operation that shouldn't be called
        operation_func = AsyncMock()
        
        with patch('src.server.services.cache_service.get_cache_service', return_value=mock_cache):
            result = await cached_operation("test_category", "test_key", operation_func)
            
            assert result == {"cached": "result"}
            # Operation should not be called due to cache hit
            operation_func.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_cached_operation_cache_miss(self):
        """Test cached operation with cache miss."""
        # Mock cache service
        mock_cache = AsyncMock()
        mock_cache.get.return_value = None  # Cache miss
        mock_cache.set.return_value = True
        
        # Mock operation that should be called
        operation_result = {"fresh": "result"}
        operation_func = AsyncMock(return_value=operation_result)
        
        with patch('src.server.services.cache_service.get_cache_service', return_value=mock_cache):
            result = await cached_operation("test_category", "test_key", operation_func, "arg1", kwarg1="value1")
            
            assert result == operation_result
            # Operation should be called with correct arguments
            operation_func.assert_called_once_with("arg1", kwarg1="value1")
            # Result should be cached
            mock_cache.set.assert_called_once_with("test_category", "test_key", operation_result)
    
    @pytest.mark.asyncio
    async def test_cached_operation_force_refresh(self):
        """Test cached operation with force refresh."""
        # Mock cache service
        mock_cache = AsyncMock()
        mock_cache.get.return_value = {"cached": "result"}  # Cache hit available
        mock_cache.set.return_value = True
        
        # Mock operation that should be called despite cache hit
        operation_result = {"fresh": "result"}
        operation_func = AsyncMock(return_value=operation_result)
        
        with patch('src.server.services.cache_service.get_cache_service', return_value=mock_cache):
            result = await cached_operation(
                "test_category", "test_key", operation_func, 
                force_refresh=True
            )
            
            assert result == operation_result
            # Operation should be called despite cache hit
            operation_func.assert_called_once()
            # Cache get should not be called due to force refresh
            mock_cache.get.assert_not_called()


class TestUtilityFunctions:
    """Test cases for utility functions."""
    
    def test_generate_cache_key(self):
        """Test cache key generation utility."""
        key = generate_cache_key("component1", "component2", 123, "component3")
        assert key == "component1:component2:123:component3"
        
        # Test with different types
        key = generate_cache_key("prefix", 42, 3.14, True)
        assert key == "prefix:42:3.14:True"


class TestErrorHandling:
    """Test cases for error handling scenarios."""
    
    @pytest.mark.asyncio
    async def test_json_serialization_error(self, mock_redis_client):
        """Test handling of JSON serialization errors."""
        service = CacheService()
        service.redis_client = mock_redis_client
        service.is_available = True
        
        # Create object that can't be JSON serialized
        class UnserializableObject:
            def __init__(self):
                self.func = lambda x: x  # Functions can't be serialized
        
        unserializable = UnserializableObject()
        
        # Should handle serialization error gracefully
        result = await service.set("test", "key", unserializable)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_json_deserialization_error(self, mock_redis_client):
        """Test handling of JSON deserialization errors."""
        service = CacheService()
        service.redis_client = mock_redis_client
        service.is_available = True
        
        # Mock corrupted JSON data
        mock_redis_client.get.return_value = "invalid json {"
        
        # Should handle deserialization error gracefully
        result = await service.get("test", "key")
        assert result is None
    
    @pytest.mark.asyncio
    async def test_redis_connection_error(self, mock_redis_client):
        """Test handling of Redis connection errors."""
        service = CacheService()
        service.redis_client = mock_redis_client
        service.is_available = True
        
        # Mock Redis connection error
        mock_redis_client.get.side_effect = Exception("Connection lost")
        
        # Should handle connection error gracefully
        result = await service.get("test", "key")
        assert result is None


@pytest.mark.integration
class TestCacheIntegration:
    """Integration tests for cache service with real Redis."""
    
    @pytest.mark.asyncio
    async def test_real_redis_integration(self):
        """
        Test with real Redis instance if available.
        This test is skipped if Redis is not available.
        """
        import os
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        
        service = CacheService()
        
        try:
            # Try to connect to real Redis
            success = await service.initialize()
            if not success:
                pytest.skip("Redis not available for integration testing")
            
            # Test basic operations
            test_data = {"integration": "test", "timestamp": "2024-01-01"}
            
            # Set and get
            await service.set("integration_test", "key1", test_data)
            result = await service.get("integration_test", "key1")
            assert result == test_data
            
            # Delete
            deleted = await service.delete("integration_test", "key1")
            assert deleted is True
            
            # Verify deletion
            result = await service.get("integration_test", "key1")
            assert result is None
            
        finally:
            await service.close()