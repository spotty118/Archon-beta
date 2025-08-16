"""
Database utilities for secure connection management.
This module provides simplified database pooling without external dependencies.
"""

import asyncio
import threading
import time
from typing import Dict, Optional, Any, AsyncGenerator, Union, List
from contextlib import asynccontextmanager
from ..config.logfire_config import get_logger

logger = get_logger(__name__)


class DatabaseConnectionManager:
    """
    Simplified database connection manager for tracking and limiting connections.
    This provides the security benefits of connection pooling without external dependencies.
    """
    
    def __init__(self, max_connections: int = 20, connection_timeout: int = 30):
        self.max_connections = max_connections
        self.connection_timeout = connection_timeout
        self.active_connections = 0
        self.connection_tracking: Dict[str, float] = {}
        self._lock = threading.RLock()
        self._connection_semaphore = asyncio.Semaphore(max_connections)
        
    @asynccontextmanager
    async def get_connection(self, connection_id: Optional[str] = None) -> AsyncGenerator[str, None]:
        """
        Context manager for database connections with automatic cleanup.
        This ensures connections are properly tracked and released.
        """
        if connection_id is None:
            connection_id = f"conn_{int(time.time() * 1000)}_{id(asyncio.current_task())}"
        
        # Acquire semaphore to limit concurrent connections
        async with self._connection_semaphore:
            try:
                # Track connection start
                with self._lock:
                    self.active_connections += 1
                    self.connection_tracking[connection_id] = time.time()
                    
                logger.debug(f"Database connection acquired - id: {connection_id}, active: {self.active_connections}")
                
                # Yield the connection identifier
                yield connection_id
                
            finally:
                # Always clean up connection tracking
                with self._lock:
                    if self.active_connections > 0:
                        self.active_connections -= 1
                    
                    if connection_id in self.connection_tracking:
                        start_time = self.connection_tracking.pop(connection_id)
                        duration = time.time() - start_time
                        
                        logger.debug(f"Database connection released - id: {connection_id}, duration: {duration:.2f}s, active: {self.active_connections}")
    
    def cleanup_expired_connections(self) -> int:
        """
        Clean up connections that have been active too long.
        Returns number of connections cleaned up.
        """
        cleaned = 0
        current_time = time.time()
        
        with self._lock:
            expired_connections = [
                conn_id for conn_id, start_time in self.connection_tracking.items()
                if current_time - start_time > self.connection_timeout
            ]
            
            for conn_id in expired_connections:
                start_time = self.connection_tracking.pop(conn_id)
                duration = current_time - start_time
                
                logger.warning(f"Cleaning up expired database connection - id: {conn_id}, duration: {duration:.2f}s")
                
                if self.active_connections > 0:
                    self.active_connections -= 1
                
                cleaned += 1
        
        return cleaned
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current connection statistics."""
        with self._lock:
            return {
                "active_connections": self.active_connections,
                "max_connections": self.max_connections,
                "tracked_connections": len(self.connection_tracking),
                "utilization": self.active_connections / self.max_connections if self.max_connections > 0 else 0
            }


class SecureQueryBuilder:
    """
    Utility class for building secure database queries.
    Helps prevent SQL injection by providing parameterized query building.
    """
    
    @staticmethod
    def build_select(table: str, columns: Optional[List[str]] = None, where_conditions: Optional[Dict[str, Any]] = None,
                    order_by: Optional[str] = None, limit: Optional[int] = None) -> tuple[str, list]:
        """
        Build a secure SELECT query with parameterized values.
        Returns (query, parameters).
        """
        # Validate table name (basic alphanumeric + underscore check)
        if not table or not table.replace('_', '').isalnum():
            raise ValueError(f"Invalid table name: {table}")
        
        # Build column list
        if columns:
            # Validate column names
            for col in columns:
                if not col or not col.replace('_', '').isalnum():
                    raise ValueError(f"Invalid column name: {col}")
            columns_str = ", ".join(columns)
        else:
            columns_str = "*"
        
        query = f"SELECT {columns_str} FROM {table}"
        parameters = []
        
        # Add WHERE conditions
        if where_conditions:
            conditions = []
            for column, value in where_conditions.items():
                # Validate column name
                if not column or not column.replace('_', '').isalnum():
                    raise ValueError(f"Invalid column name in WHERE: {column}")
                conditions.append(f"{column} = $%d" % (len(parameters) + 1))
                parameters.append(value)
            
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
        
        # Add ORDER BY
        if order_by:
            # Validate order by column
            if not order_by.replace('_', '').replace(' ', '').replace('DESC', '').replace('ASC', '').isalnum():
                raise ValueError(f"Invalid ORDER BY clause: {order_by}")
            query += f" ORDER BY {order_by}"
        
        # Add LIMIT
        if limit:
            if not isinstance(limit, int) or limit <= 0:
                raise ValueError(f"Invalid LIMIT value: {limit}")
            query += f" LIMIT {limit}"
        
        return query, parameters
    
    @staticmethod
    def build_insert(table: str, data: dict) -> tuple[str, list]:
        """
        Build a secure INSERT query with parameterized values.
        Returns (query, parameters).
        """
        # Validate table name
        if not table or not table.replace('_', '').isalnum():
            raise ValueError(f"Invalid table name: {table}")
        
        if not data:
            raise ValueError("No data provided for INSERT")
        
        # Validate column names and build query
        columns = []
        parameters = []
        placeholders = []
        
        for column, value in data.items():
            if not column or not column.replace('_', '').isalnum():
                raise ValueError(f"Invalid column name: {column}")
            
            columns.append(column)
            parameters.append(value)
            placeholders.append(f"${len(parameters)}")
        
        columns_str = ", ".join(columns)
        placeholders_str = ", ".join(placeholders)
        
        query = f"INSERT INTO {table} ({columns_str}) VALUES ({placeholders_str})"
        
        return query, parameters
    
    @staticmethod
    def build_update(table: str, data: dict, where_conditions: dict) -> tuple[str, list]:
        """
        Build a secure UPDATE query with parameterized values.
        Returns (query, parameters).
        """
        # Validate table name
        if not table or not table.replace('_', '').isalnum():
            raise ValueError(f"Invalid table name: {table}")
        
        if not data:
            raise ValueError("No data provided for UPDATE")
        
        if not where_conditions:
            raise ValueError("No WHERE conditions provided for UPDATE (safety check)")
        
        parameters = []
        
        # Build SET clause
        set_clauses = []
        for column, value in data.items():
            if not column or not column.replace('_', '').isalnum():
                raise ValueError(f"Invalid column name: {column}")
            
            parameters.append(value)
            set_clauses.append(f"{column} = ${len(parameters)}")
        
        # Build WHERE clause
        where_clauses = []
        for column, value in where_conditions.items():
            if not column or not column.replace('_', '').isalnum():
                raise ValueError(f"Invalid column name in WHERE: {column}")
            
            parameters.append(value)
            where_clauses.append(f"{column} = ${len(parameters)}")
        
        set_str = ", ".join(set_clauses)
        where_str = " AND ".join(where_clauses)
        
        query = f"UPDATE {table} SET {set_str} WHERE {where_str}"
        
        return query, parameters


# Global connection manager instance
_global_connection_manager = None
_manager_lock = threading.Lock()


def get_connection_manager() -> DatabaseConnectionManager:
    """Get the global database connection manager instance."""
    global _global_connection_manager
    
    if _global_connection_manager is None:
        with _manager_lock:
            if _global_connection_manager is None:
                _global_connection_manager = DatabaseConnectionManager()
    
    return _global_connection_manager


async def get_secure_connection(connection_id: Optional[str] = None):
    """
    Get a secure database connection with automatic tracking and cleanup.
    
    Usage:
        async with get_secure_connection() as conn_id:
            # Use connection_id for database operations
            # Connection is automatically tracked and cleaned up
            pass
    """
    manager = get_connection_manager()
    return manager.get_connection(connection_id)


def build_secure_query(query_type: str, table: str, **kwargs) -> tuple[str, list]:
    """
    Build a secure parameterized query using the SecureQueryBuilder.
    
    Args:
        query_type: 'select', 'insert', or 'update'
        table: Table name
        **kwargs: Query-specific parameters
    
    Returns:
        tuple[str, list]: (query, parameters)
    """
    builder = SecureQueryBuilder()
    
    if query_type.lower() == 'select':
        return builder.build_select(table, **kwargs)
    elif query_type.lower() == 'insert':
        return builder.build_insert(table, kwargs.get('data', {}))
    elif query_type.lower() == 'update':
        return builder.build_update(table, kwargs.get('data', {}), kwargs.get('where_conditions', {}))
    else:
        raise ValueError(f"Unsupported query type: {query_type}")


async def cleanup_expired_connections_task():
    """Background task to periodically clean up expired database connections."""
    manager = get_connection_manager()
    
    while True:
        try:
            cleaned = manager.cleanup_expired_connections()
            if cleaned > 0:
                logger.info(f"Cleaned up {cleaned} expired database connections")
            
            await asyncio.sleep(60)  # Check every minute
            
        except Exception as e:
            logger.error(f"Error in database cleanup task: {e}")
            await asyncio.sleep(60)