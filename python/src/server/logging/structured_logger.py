"""
Structured Logging with Correlation IDs for Archon V2 Beta

Production-ready logging infrastructure with:
- Structured JSON logging for better observability
- Request correlation IDs for distributed tracing
- Error context enrichment with stack traces
- Performance metrics and timing
- Security audit logging
"""

import logging
import json
import time
import uuid
import traceback
from typing import Dict, Any, Optional, Union
from datetime import datetime, timezone
from functools import wraps
from contextvars import ContextVar
from dataclasses import dataclass, asdict

# Context variables for correlation tracking
correlation_id_var: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)
user_id_var: ContextVar[Optional[str]] = ContextVar("user_id", default=None)
request_path_var: ContextVar[Optional[str]] = ContextVar("request_path", default=None)


@dataclass
class LogContext:
    """Structured context for log entries"""
    timestamp: str
    level: str
    logger: str
    message: str
    correlation_id: Optional[str] = None
    user_id: Optional[str] = None
    request_path: Optional[str] = None
    service: str = "archon-api"
    version: str = "2.0.0-beta"
    environment: str = "development"
    
    # Performance metrics
    duration_ms: Optional[float] = None
    memory_mb: Optional[float] = None
    
    # Error context
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    stack_trace: Optional[str] = None
    
    # Additional context
    extra: Optional[Dict[str, Any]] = None


class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured JSON logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON"""
        
        # Get context variables
        correlation_id = correlation_id_var.get()
        user_id = user_id_var.get()
        request_path = request_path_var.get()
        
        # Create structured log context
        log_context = LogContext(
            timestamp=datetime.now(timezone.utc).isoformat(),
            level=record.levelname,
            logger=record.name,
            message=record.getMessage(),
            correlation_id=correlation_id,
            user_id=user_id,
            request_path=request_path
        )
        
        # Add exception information if present
        if record.exc_info:
            log_context.error_type = record.exc_info[0].__name__
            log_context.error_message = str(record.exc_info[1])
            log_context.stack_trace = ''.join(traceback.format_exception(*record.exc_info))
        
        # Add extra fields from log record
        extra_fields = {}
        for key, value in record.__dict__.items():
            if key not in ('name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
                          'filename', 'module', 'lineno', 'funcName', 'created', 'msecs',
                          'relativeCreated', 'thread', 'threadName', 'processName',
                          'process', 'getMessage', 'exc_info', 'exc_text', 'stack_info'):
                extra_fields[key] = value
        
        if extra_fields:
            log_context.extra = extra_fields
        
        # Convert to JSON
        return json.dumps(asdict(log_context), default=str, ensure_ascii=False)


class CorrelationLogger:
    """Enhanced logger with correlation ID support"""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self._setup_logger()
    
    def _setup_logger(self):
        """Setup structured logging configuration"""
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(StructuredFormatter())
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
    
    def _log_with_context(self, level: int, message: str, **kwargs):
        """Log message with additional context"""
        self.logger.log(level, message, extra=kwargs)
    
    def debug(self, message: str, **kwargs):
        """Log debug message"""
        self._log_with_context(logging.DEBUG, message, **kwargs)
    
    def info(self, message: str, **kwargs):
        """Log info message"""
        self._log_with_context(logging.INFO, message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log warning message"""
        self._log_with_context(logging.WARNING, message, **kwargs)
    
    def error(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log error message with optional exception"""
        if error:
            kwargs['error_type'] = type(error).__name__
            kwargs['error_message'] = str(error)
            self.logger.error(message, exc_info=error, extra=kwargs)
        else:
            self._log_with_context(logging.ERROR, message, **kwargs)
    
    def critical(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log critical message"""
        if error:
            kwargs['error_type'] = type(error).__name__
            kwargs['error_message'] = str(error)
            self.logger.critical(message, exc_info=error, extra=kwargs)
        else:
            self._log_with_context(logging.CRITICAL, message, **kwargs)
    
    # Convenience methods for common logging patterns
    
    def api_request(self, method: str, path: str, status_code: int, duration_ms: float, **kwargs):
        """Log API request with performance metrics"""
        self.info(
            f"API Request: {method} {path}",
            http_method=method,
            http_path=path,
            http_status=status_code,
            duration_ms=duration_ms,
            **kwargs
        )
    
    def database_query(self, operation: str, table: str, duration_ms: float, row_count: Optional[int] = None, **kwargs):
        """Log database operation"""
        self.info(
            f"Database {operation}: {table}",
            db_operation=operation,
            db_table=table,
            duration_ms=duration_ms,
            row_count=row_count,
            **kwargs
        )
    
    def cache_operation(self, operation: str, key: str, hit: bool, duration_ms: Optional[float] = None, **kwargs):
        """Log cache operation"""
        self.info(
            f"Cache {operation}: {key}",
            cache_operation=operation,
            cache_key=key,
            cache_hit=hit,
            duration_ms=duration_ms,
            **kwargs
        )
    
    def external_service(self, service: str, endpoint: str, status_code: int, duration_ms: float, **kwargs):
        """Log external service call"""
        self.info(
            f"External Service: {service} {endpoint}",
            external_service=service,
            external_endpoint=endpoint,
            external_status=status_code,
            duration_ms=duration_ms,
            **kwargs
        )
    
    def security_event(self, event_type: str, severity: str, details: Dict[str, Any], **kwargs):
        """Log security-related events"""
        self.warning(
            f"Security Event: {event_type}",
            security_event_type=event_type,
            security_severity=severity,
            security_details=details,
            **kwargs
        )
    
    def business_event(self, event_type: str, entity_type: str, entity_id: str, action: str, **kwargs):
        """Log business logic events"""
        self.info(
            f"Business Event: {action} {entity_type}",
            business_event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            business_action=action,
            **kwargs
        )


def get_logger(name: str) -> CorrelationLogger:
    """Get or create a correlation logger"""
    return CorrelationLogger(name)


def set_correlation_id(correlation_id: str):
    """Set correlation ID for current context"""
    correlation_id_var.set(correlation_id)


def get_correlation_id() -> Optional[str]:
    """Get current correlation ID"""
    return correlation_id_var.get()


def set_user_context(user_id: str):
    """Set user context for current request"""
    user_id_var.set(user_id)


def set_request_context(request_path: str):
    """Set request context"""
    request_path_var.set(request_path)


def generate_correlation_id() -> str:
    """Generate a new correlation ID"""
    return str(uuid.uuid4())


def log_performance(operation_name: str, logger: Optional[CorrelationLogger] = None):
    """Decorator to log function performance"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            correlation_logger = logger or get_logger(func.__module__)
            
            try:
                correlation_logger.debug(f"Starting operation: {operation_name}")
                result = func(*args, **kwargs)
                
                duration_ms = (time.time() - start_time) * 1000
                correlation_logger.info(
                    f"Operation completed: {operation_name}",
                    operation=operation_name,
                    duration_ms=duration_ms,
                    success=True
                )
                
                return result
                
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                correlation_logger.error(
                    f"Operation failed: {operation_name}",
                    operation=operation_name,
                    duration_ms=duration_ms,
                    success=False,
                    error=e
                )
                raise
                
        return wrapper
    return decorator


def alog_performance(operation_name: str, logger: Optional[CorrelationLogger] = None):
    """Async decorator to log function performance"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            correlation_logger = logger or get_logger(func.__module__)
            
            try:
                correlation_logger.debug(f"Starting async operation: {operation_name}")
                result = await func(*args, **kwargs)
                
                duration_ms = (time.time() - start_time) * 1000
                correlation_logger.info(
                    f"Async operation completed: {operation_name}",
                    operation=operation_name,
                    duration_ms=duration_ms,
                    success=True
                )
                
                return result
                
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                correlation_logger.error(
                    f"Async operation failed: {operation_name}",
                    operation=operation_name,
                    duration_ms=duration_ms,
                    success=False,
                    error=e
                )
                raise
                
        return wrapper
    return decorator


# Module-level logger
logger = get_logger(__name__)


# Export commonly used functions
__all__ = [
    'CorrelationLogger',
    'LogContext',
    'get_logger',
    'set_correlation_id',
    'get_correlation_id',
    'set_user_context',
    'set_request_context',
    'generate_correlation_id',
    'log_performance',
    'alog_performance',
    'logger'
]