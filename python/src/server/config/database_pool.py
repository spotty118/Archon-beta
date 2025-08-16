"""
Database Connection Pool Configuration

Provides connection pooling for Supabase to prevent connection exhaustion
and improve performance under load.
"""

import asyncio
import asyncpg
from typing import Optional, Dict, Any
import structlog
from contextlib import asynccontextmanager

logger = structlog.get_logger(__name__)

class DatabasePool:
    """Thread-safe database connection pool with automatic cleanup"""
    
    def __init__(self, 
                 connection_string: str,
                 min_connections: int = 5,
                 max_connections: int = 20,
                 command_timeout: float = 60.0,
                 max_idle_time: float = 300.0):
        self.connection_string = connection_string
        self.min_connections = min_connections
        self.max_connections = max_connections
        self.command_timeout = command_timeout
        self.max_idle_time = max_idle_time
        self._pool: Optional[asyncpg.Pool] = None
        self._lock = asyncio.Lock()
        
    async def initialize(self) -> bool:
        """Initialize the connection pool"""
        try:
            async with self._lock:
                if self._pool is None:
                    self._pool = await asyncpg.create_pool(
                        self.connection_string,
                        min_size=self.min_connections,
                        max_size=self.max_connections,
                        command_timeout=self.command_timeout,
                        max_inactive_connection_lifetime=self.max_idle_time,
                        # Security: Use SSL and verify certificates
                        ssl='require',
                        server_settings={
                            'jit': 'off'  # Disable JIT for consistent performance
                        }
                    )
                    logger.info(f"Database pool initialized with {self.min_connections}-{self.max_connections} connections")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {e}")
            return False
    
    async def close(self):
        """Close the connection pool"""
        async with self._lock:
            if self._pool:
                await self._pool.close()
                self._pool = None
                logger.info("Database pool closed")
    
    @asynccontextmanager
    async def acquire(self):
        """Acquire a connection from the pool"""
        if not self._pool:
            raise RuntimeError("Database pool not initialized")
        
        async with self._pool.acquire() as connection:
            try:
                yield connection
            except Exception as e:
                logger.error(f"Database operation failed: {e}")
                raise
    
    async def execute(self, query: str, *args) -> str:
        """Execute a query with automatic connection management"""
        async with self.acquire() as conn:
            return await conn.execute(query, *args)
    
    async def fetch(self, query: str, *args) -> list:
        """Fetch multiple rows with automatic connection management"""
        async with self.acquire() as conn:
            return await conn.fetch(query, *args)
    
    async def fetchrow(self, query: str, *args) -> Optional[Dict[str, Any]]:
        """Fetch a single row with automatic connection management"""
        async with self.acquire() as conn:
            return await conn.fetchrow(query, *args)
    
    async def transaction(self):
        """Get a transaction context manager"""
        if not self._pool:
            raise RuntimeError("Database pool not initialized")
        
        return self._pool.acquire()
    
    def get_pool_status(self) -> Dict[str, Any]:
        """Get current pool status for monitoring"""
        if not self._pool:
            return {"status": "not_initialized"}
        
        return {
            "status": "active",
            "size": self._pool.get_size(),
            "idle_connections": self._pool.get_idle_size(),
            "min_size": self._pool.get_min_size(),
            "max_size": self._pool.get_max_size()
        }

# Global pool instance
_db_pool: Optional[DatabasePool] = None

async def initialize_database_pool(connection_string: str) -> bool:
    """Initialize the global database pool"""
    global _db_pool
    
    if _db_pool is None:
        _db_pool = DatabasePool(connection_string)
        success = await _db_pool.initialize()
        if success:
            logger.info("Global database pool initialized successfully")
        return success
    return True

async def get_database_pool() -> DatabasePool:
    """Get the global database pool instance"""
    if _db_pool is None:
        raise RuntimeError("Database pool not initialized. Call initialize_database_pool() first.")
    return _db_pool

async def close_database_pool():
    """Close the global database pool"""
    global _db_pool
    if _db_pool:
        await _db_pool.close()
        _db_pool = None

@asynccontextmanager
async def get_db_connection():
    """Get a database connection from the pool"""
    pool = await get_database_pool()
    async with pool.acquire() as conn:
        yield conn

async def execute_with_retry(query: str, *args, max_retries: int = 3) -> Any:
    """Execute a query with automatic retry on connection failures"""
    pool = await get_database_pool()
    
    for attempt in range(max_retries):
        try:
            return await pool.execute(query, *args)
        except (asyncpg.ConnectionDoesNotExistError, 
                asyncpg.InterfaceError, 
                asyncpg.ConnectionFailureError) as e:
            if attempt == max_retries - 1:
                logger.error(f"Database query failed after {max_retries} attempts: {e}")
                raise
            logger.warning(f"Database connection failed, retrying... (attempt {attempt + 1}/{max_retries})")
            await asyncio.sleep(0.5 * (attempt + 1))  # Exponential backoff
        except Exception as e:
            logger.error(f"Database query failed with non-connection error: {e}")
            raise