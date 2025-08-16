"""
Error Context Enrichment for Archon V2 Beta

Advanced error handling with:
- Automatic error classification and severity assessment
- Context enrichment with request/user/system information
- Error aggregation and pattern detection
- Integration with monitoring and alerting systems
"""

import traceback
import sys
import inspect
import psutil
import time
from typing import Dict, Any, Optional, List, Type, Union
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from functools import wraps
from enum import Enum

from src.server.logging.structured_logger import (
    get_logger,
    get_correlation_id,
    CorrelationLogger
)

logger = get_logger(__name__)


class ErrorSeverity(Enum):
    """Error severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory(Enum):
    """Error categories for classification"""
    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    BUSINESS_LOGIC = "business_logic"
    EXTERNAL_SERVICE = "external_service"
    DATABASE = "database"
    NETWORK = "network"
    SYSTEM = "system"
    UNKNOWN = "unknown"


@dataclass
class ErrorContext:
    """Enriched error context information"""
    
    # Basic error information
    error_id: str
    timestamp: str
    correlation_id: Optional[str]
    
    # Error classification
    error_type: str
    error_message: str
    error_category: ErrorCategory
    severity: ErrorSeverity
    
    # Stack trace and code context
    stack_trace: str
    error_location: Dict[str, Any]
    local_variables: Dict[str, Any]
    
    # System context
    system_info: Dict[str, Any]
    performance_metrics: Dict[str, Any]
    
    # Request context (if available)
    request_context: Optional[Dict[str, Any]] = None
    
    # User context (if available)  
    user_context: Optional[Dict[str, Any]] = None
    
    # Additional context
    tags: List[str] = None
    custom_data: Optional[Dict[str, Any]] = None


class ErrorClassifier:
    """Classifies errors into categories and severity levels"""
    
    def __init__(self):
        self.classification_rules = {
            # Validation errors
            (ValueError, TypeError, AttributeError): (ErrorCategory.VALIDATION, ErrorSeverity.LOW),
            
            # Authentication/Authorization
            ("AuthenticationError", "PermissionError"): (ErrorCategory.AUTHENTICATION, ErrorSeverity.MEDIUM),
            ("AuthorizationError", "Forbidden"): (ErrorCategory.AUTHORIZATION, ErrorSeverity.MEDIUM),
            
            # Database errors
            ("DatabaseError", "IntegrityError", "OperationalError"): (ErrorCategory.DATABASE, ErrorSeverity.HIGH),
            
            # Network/External service errors
            ("ConnectionError", "TimeoutError", "HTTPError"): (ErrorCategory.EXTERNAL_SERVICE, ErrorSeverity.MEDIUM),
            
            # System errors
            (MemoryError, OSError, SystemError): (ErrorCategory.SYSTEM, ErrorSeverity.CRITICAL),
        }
    
    def classify_error(self, error: Exception) -> tuple[ErrorCategory, ErrorSeverity]:
        """Classify error by type and determine severity"""
        
        error_type = type(error)
        error_name = error_type.__name__
        
        # Check exact type matches
        for error_types, (category, severity) in self.classification_rules.items():
            if isinstance(error_types, tuple):
                if error_type in error_types:
                    return category, severity
            else:
                if error_name in error_types:
                    return category, severity
        
        # Check error message for patterns
        error_message = str(error).lower()
        
        if any(term in error_message for term in ["timeout", "connection", "network"]):
            return ErrorCategory.NETWORK, ErrorSeverity.MEDIUM
        
        if any(term in error_message for term in ["database", "sql", "query"]):
            return ErrorCategory.DATABASE, ErrorSeverity.HIGH
        
        if any(term in error_message for term in ["permission", "access", "denied"]):
            return ErrorCategory.AUTHORIZATION, ErrorSeverity.MEDIUM
        
        if any(term in error_message for term in ["validation", "invalid", "required"]):
            return ErrorCategory.VALIDATION, ErrorSeverity.LOW
        
        # Default classification
        return ErrorCategory.UNKNOWN, ErrorSeverity.MEDIUM


class ErrorEnricher:
    """Enriches errors with context information"""
    
    def __init__(self):
        self.classifier = ErrorClassifier()
    
    def enrich_error(
        self,
        error: Exception,
        additional_context: Optional[Dict[str, Any]] = None,
        capture_locals: bool = True,
        capture_system_info: bool = True
    ) -> ErrorContext:
        """Enrich error with comprehensive context"""
        
        # Generate unique error ID
        error_id = f"err_{int(time.time() * 1000000)}"
        
        # Classify error
        category, severity = self.classifier.classify_error(error)
        
        # Get stack trace and location
        stack_trace = traceback.format_exc()
        error_location = self._get_error_location()
        
        # Capture local variables if requested
        local_vars = self._capture_local_variables() if capture_locals else {}
        
        # Get system information
        system_info = self._get_system_info() if capture_system_info else {}
        performance_metrics = self._get_performance_metrics() if capture_system_info else {}
        
        # Build error context
        context = ErrorContext(
            error_id=error_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            correlation_id=get_correlation_id(),
            error_type=type(error).__name__,
            error_message=str(error),
            error_category=category,
            severity=severity,
            stack_trace=stack_trace,
            error_location=error_location,
            local_variables=local_vars,
            system_info=system_info,
            performance_metrics=performance_metrics,
            custom_data=additional_context
        )
        
        return context
    
    def _get_error_location(self) -> Dict[str, Any]:
        """Get error location information"""
        frame = sys.exc_info()[2]
        if frame is None:
            return {}
        
        # Walk up the stack to find the actual error location
        while frame.tb_next is not None:
            frame = frame.tb_next
        
        code = frame.tb_frame.f_code
        
        return {
            "file": code.co_filename,
            "function": code.co_name,
            "line_number": frame.tb_lineno,
            "module": frame.tb_frame.f_globals.get("__name__", "unknown")
        }
    
    def _capture_local_variables(self, max_vars: int = 10) -> Dict[str, Any]:
        """Capture local variables from the error frame"""
        frame = sys.exc_info()[2]
        if frame is None:
            return {}
        
        # Get the frame where the error occurred
        while frame.tb_next is not None:
            frame = frame.tb_next
        
        local_vars = {}
        frame_locals = frame.tb_frame.f_locals
        
        # Limit number of variables and sanitize values
        count = 0
        for name, value in frame_locals.items():
            if count >= max_vars:
                break
            
            # Skip private variables and large objects
            if name.startswith("_") or name in ["self", "cls"]:
                continue
            
            try:
                # Convert to string and limit size
                str_value = str(value)
                if len(str_value) > 200:
                    str_value = str_value[:200] + "..."
                
                local_vars[name] = str_value
                count += 1
                
            except Exception:
                local_vars[name] = "<error converting to string>"
        
        return local_vars
    
    def _get_system_info(self) -> Dict[str, Any]:
        """Get current system information"""
        try:
            return {
                "cpu_percent": psutil.cpu_percent(),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_usage_percent": psutil.disk_usage("/").percent,
                "load_average": psutil.getloadavg() if hasattr(psutil, "getloadavg") else None,
                "open_files": len(psutil.Process().open_files()) if hasattr(psutil.Process(), "open_files") else None,
                "thread_count": psutil.Process().num_threads()
            }
        except Exception as e:
            logger.warning("Failed to collect system info", error=e)
            return {}
    
    def _get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics at time of error"""
        try:
            process = psutil.Process()
            return {
                "memory_rss_mb": process.memory_info().rss / 1024 / 1024,
                "memory_vms_mb": process.memory_info().vms / 1024 / 1024,
                "cpu_times": process.cpu_times()._asdict(),
                "io_counters": process.io_counters()._asdict() if process.io_counters() else None,
                "num_fds": process.num_fds() if hasattr(process, "num_fds") else None
            }
        except Exception as e:
            logger.warning("Failed to collect performance metrics", error=e)
            return {}


class ErrorHandler:
    """Centralized error handling with enrichment and logging"""
    
    def __init__(self):
        self.enricher = ErrorEnricher()
        self.error_counts: Dict[str, int] = {}  # Track error patterns
    
    def handle_error(
        self,
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        notify_monitoring: bool = True,
        reraise: bool = True
    ) -> ErrorContext:
        """Handle error with full enrichment and logging"""
        
        # Enrich error with context
        error_context = self.enricher.enrich_error(error, context)
        
        # Track error patterns
        error_key = f"{error_context.error_type}:{error_context.error_location.get('function', 'unknown')}"
        self.error_counts[error_key] = self.error_counts.get(error_key, 0) + 1
        
        # Log error based on severity
        self._log_error(error_context)
        
        # Notify monitoring systems if enabled
        if notify_monitoring:
            self._notify_monitoring(error_context)
        
        # Reraise if requested
        if reraise:
            raise
        
        return error_context
    
    def _log_error(self, error_context: ErrorContext):
        """Log error with appropriate level based on severity"""
        
        log_data = {
            "error_id": error_context.error_id,
            "error_category": error_context.error_category.value,
            "error_location": error_context.error_location,
            "system_info": error_context.system_info,
            "performance_metrics": error_context.performance_metrics
        }
        
        if error_context.severity == ErrorSeverity.CRITICAL:
            logger.critical(
                f"Critical error: {error_context.error_message}",
                **log_data
            )
        elif error_context.severity == ErrorSeverity.HIGH:
            logger.error(
                f"High severity error: {error_context.error_message}",
                **log_data
            )
        elif error_context.severity == ErrorSeverity.MEDIUM:
            logger.warning(
                f"Medium severity error: {error_context.error_message}",
                **log_data
            )
        else:
            logger.info(
                f"Low severity error: {error_context.error_message}",
                **log_data
            )
    
    def _notify_monitoring(self, error_context: ErrorContext):
        """Notify external monitoring systems"""
        # This would integrate with systems like Sentry, DataDog, etc.
        # For now, we'll just log the notification
        
        logger.info(
            "Error notification sent to monitoring",
            error_id=error_context.error_id,
            severity=error_context.severity.value,
            category=error_context.error_category.value
        )
    
    def get_error_patterns(self) -> Dict[str, int]:
        """Get current error patterns for analysis"""
        return self.error_counts.copy()


# Global error handler instance
error_handler = ErrorHandler()


def handle_errors(
    capture_locals: bool = True,
    capture_system_info: bool = True,
    notify_monitoring: bool = True,
    reraise: bool = True,
    additional_context: Optional[Dict[str, Any]] = None
):
    """Decorator for automatic error handling with enrichment"""
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                error_handler.handle_error(
                    error=e,
                    context=additional_context,
                    notify_monitoring=notify_monitoring,
                    reraise=reraise
                )
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                error_handler.handle_error(
                    error=e,
                    context=additional_context,
                    notify_monitoring=notify_monitoring,
                    reraise=reraise
                )
        
        # Return appropriate wrapper based on function type
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return wrapper
    
    return decorator


def safe_execute(
    func,
    *args,
    default_return=None,
    log_errors: bool = True,
    **kwargs
):
    """Safely execute function with error handling"""
    try:
        return func(*args, **kwargs)
    except Exception as e:
        if log_errors:
            error_handler.handle_error(e, reraise=False)
        return default_return


async def safe_execute_async(
    func,
    *args,
    default_return=None,
    log_errors: bool = True,
    **kwargs
):
    """Safely execute async function with error handling"""
    try:
        return await func(*args, **kwargs)
    except Exception as e:
        if log_errors:
            error_handler.handle_error(e, reraise=False)
        return default_return


__all__ = [
    'ErrorContext',
    'ErrorSeverity',
    'ErrorCategory',
    'ErrorClassifier',
    'ErrorEnricher',
    'ErrorHandler',
    'error_handler',
    'handle_errors',
    'safe_execute',
    'safe_execute_async'
]