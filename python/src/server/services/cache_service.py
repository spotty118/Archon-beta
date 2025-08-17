"""
Redis Cache Service for Archon V2 Beta

Provides centralized caching for:
- Source metadata (TTL: 1 hour)
- Embedding results (TTL: 24 hours)
- User credentials (TTL: 30 minutes)
- RAG query results (TTL: 15 minutes)

Features:
- Automatic TTL management
- Cache invalidation strategies
- JSON serialization for complex objects
- Connection pooling and health monitoring
- Fallback to database when cache unavailable
"""

import asyncio
import json
import os
import time
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta

import redis.asyncio as redis
from redis.asyncio import ConnectionPool

from ..config.logfire_config import get_logger

logger = get_logger(__name__)

class CacheService:
    """
    Centralized Redis caching service with intelligent TTL and invalidation.
    """
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.connection_pool: Optional[ConnectionPool] = None
        self.is_available = False
        
        # TTL Configuration (in seconds)
        self.ttl_config = {
            "sources": 3600,          # 1 hour
            "embeddings": 86400,      # 24 hours  
            "credentials": 1800,      # 30 minutes
            "rag_queries": 900,       # 15 minutes
            "project_features": 7200, # 2 hours
            "user_sessions": 3600,    # 1 hour
            "default": 1800           # 30 minutes default
        }
        
        # Cache key prefixes for organization
        self.key_prefixes = {
            "sources": "src:",
            "embeddings": "emb:",
            "credentials": "cred:",
            "rag_queries": "rag:",
            "project_features": "proj:",
            "user_sessions": "sess:",
        }
    
    async def initialize(self) -> bool:
        """
        Initialize Redis connection with health check.
        Returns True if Redis is available, False for graceful fallback.
        """
        try:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            
            # Create connection pool for optimal performance
            self.connection_pool = ConnectionPool.from_url(
                redis_url,
                max_connections=20,
                retry_on_timeout=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                health_check_interval=30
            )
            
            # Create Redis client
            self.redis_client = redis.Redis(
                connection_pool=self.connection_pool,
                decode_responses=True
            )
            
            # Test connection
            await self.redis_client.ping()
            self.is_available = True
            
            logger.info("✅ Redis cache service initialized successfully")
            return True
            
        except Exception as e:
            logger.warning(f"Redis cache unavailable, falling back to database: {e}")
            self.is_available = False
            return False
    
    async def close(self):
        """Clean up Redis connections."""
        if self.redis_client:
            await self.redis_client.close()
        if self.connection_pool:
            await self.connection_pool.disconnect()
        logger.info("Redis cache service closed")
    
    def _get_cache_key(self, category: str, key: str) -> str:
        """Generate properly prefixed cache key."""
        prefix = self.key_prefixes.get(category, "misc:")
        return f"{prefix}{key}"
    
    def _get_ttl(self, category: str) -> int:
        """Get TTL for cache category."""
        return self.ttl_config.get(category, self.ttl_config["default"])
    
    async def get(self, category: str, key: str) -> Optional[Any]:
        """
        Get cached value with automatic JSON deserialization.
        Returns None if cache miss or Redis unavailable.
        """
        if not self.is_available or not self.redis_client:
            return None
        
        try:
            cache_key = self._get_cache_key(category, key)
            cached_value = await self.redis_client.get(cache_key)
            
            if cached_value is None:
                return None
            
            # Deserialize JSON
            return json.loads(cached_value)
            
        except Exception as e:
            logger.warning(f"Cache get failed for {category}:{key}: {e}")
            return None
    
    async def set(self, category: str, key: str, value: Any) -> bool:
        """
        Set cached value with automatic JSON serialization and TTL.
        Returns True if successful, False if Redis unavailable.
        """
        if not self.is_available or not self.redis_client:
            return False
        
        try:
            cache_key = self._get_cache_key(category, key)
            ttl = self._get_ttl(category)
            
            # Serialize to JSON
            serialized_value = json.dumps(value, default=str)
            
            # Set with TTL
            await self.redis_client.setex(cache_key, ttl, serialized_value)
            
            logger.debug(f"Cached {category}:{key} with TTL {ttl}s")
            return True
            
        except Exception as e:
            logger.warning(f"Cache set failed for {category}:{key}: {e}")
            return False
    
    async def delete(self, category: str, key: str) -> bool:
        """Delete specific cache entry."""
        if not self.is_available or not self.redis_client:
            return False
        
        try:
            cache_key = self._get_cache_key(category, key)
            result = await self.redis_client.delete(cache_key)
            return result > 0
            
        except Exception as e:
            logger.warning(f"Cache delete failed for {category}:{key}: {e}")
            return False
    
    async def invalidate_pattern(self, category: str, pattern: str = "*") -> int:
        """
        Invalidate cache entries matching pattern.
        Returns number of keys deleted.
        """
        if not self.is_available or not self.redis_client:
            return 0
        
        try:
            cache_pattern = self._get_cache_key(category, pattern)
            
            # Use SCAN to avoid blocking Redis; batch deletes for efficiency
            deleted_total = 0
            batch: list[str] = []
            async for key in self.redis_client.scan_iter(match=cache_pattern, count=1000):
                batch.append(key)
                if len(batch) >= 500:
                    await self.redis_client.delete(*batch)
                    deleted_total += len(batch)
                    batch.clear()
            if batch:
                await self.redis_client.delete(*batch)
                deleted_total += len(batch)
            if deleted_total:
                logger.info(f"Invalidated {deleted_total} cache entries for {category}:{pattern}")
            return deleted_total
         
        except Exception as e:
            logger.warning(f"Cache invalidation failed for {category}:{pattern}: {e}")
            return 0
    
    async def clear_all(self) -> bool:
        """Clear all cache entries (use with caution)."""
        if not self.is_available or not self.redis_client:
            return False
        
        try:
            await self.redis_client.flushdb()
            logger.info("All cache entries cleared")
            return True
            
        except Exception as e:
            logger.error(f"Cache clear failed: {e}")
            return False
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics and health information."""
        if not self.is_available or not self.redis_client:
            return {"available": False, "error": "Redis not available"}
        
        try:
            info = await self.redis_client.info()
            return {
                "available": True,
                "connected_clients": info.get("connected_clients", 0),
                "used_memory": info.get("used_memory_human", "0B"),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "hit_rate": self._calculate_hit_rate(
                    info.get("keyspace_hits", 0),
                    info.get("keyspace_misses", 0)
                ),
                "total_commands_processed": info.get("total_commands_processed", 0),
                "uptime_in_seconds": info.get("uptime_in_seconds", 0)
            }
            
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {"available": False, "error": str(e)}
    
    def _calculate_hit_rate(self, hits: int, misses: int) -> float:
        """Calculate cache hit rate percentage."""
        total = hits + misses
        if total == 0:
            return 0.0
        return round((hits / total) * 100, 2)
    
    # Specialized caching methods for common use cases
    
    async def cache_source_metadata(self, source_id: str, metadata: Dict[str, Any]) -> bool:
        """Cache source metadata with 1 hour TTL."""
        return await self.set("sources", source_id, metadata)
    
    async def get_source_metadata(self, source_id: str) -> Optional[Dict[str, Any]]:
        """Get cached source metadata."""
        return await self.get("sources", source_id)
    
    async def cache_embedding_result(self, text_hash: str, embedding: List[float]) -> bool:
        """Cache embedding result with 24 hour TTL."""
        return await self.set("embeddings", text_hash, embedding)
    
    async def get_embedding_result(self, text_hash: str) -> Optional[List[float]]:
        """Get cached embedding result."""
        return await self.get("embeddings", text_hash)
    
    async def cache_rag_query(self, query_hash: str, results: List[Dict[str, Any]]) -> bool:
        """Cache RAG query results with 15 minute TTL."""
        return await self.set("rag_queries", query_hash, results)
    
    async def get_rag_query(self, query_hash: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached RAG query results."""
        return await self.get("rag_queries", query_hash)
    
    async def invalidate_source_cache(self, source_id: str) -> bool:
        """Invalidate all cache entries for a source."""
        await self.delete("sources", source_id)
        # Also invalidate related RAG queries
        await self.invalidate_pattern("rag_queries", f"*{source_id}*")
        return True

# Global cache service instance
cache_service = CacheService()

async def get_cache_service() -> CacheService:
    """Get the global cache service instance."""
    if not cache_service.is_available:
        await cache_service.initialize()
    return cache_service

# Utility functions for common caching patterns

async def cached_operation(
    category: str, 
    key: str, 
    operation_func,
    *args,
    force_refresh: bool = False,
    **kwargs
) -> Any:
    """
    Execute operation with automatic caching.
    
    Args:
        category: Cache category
        key: Cache key
        operation_func: Function to execute if cache miss
        force_refresh: Skip cache and force operation execution
        *args, **kwargs: Arguments for operation_func
    
    Returns:
        Result from cache or operation
    """
    cache = await get_cache_service()
    
    # Check cache first (unless force refresh)
    if not force_refresh:
        cached_result = await cache.get(category, key)
        if cached_result is not None:
            logger.debug(f"Cache hit for {category}:{key}")
            return cached_result
    
    # Execute operation
    logger.debug(f"Cache miss for {category}:{key}, executing operation")
    result = await operation_func(*args, **kwargs)
    
    # Cache the result
    await cache.set(category, key, result)
    
    return result

def generate_cache_key(*components: Union[str, int, float]) -> str:
    """Generate cache key from components."""
    return ":".join(str(c) for c in components)