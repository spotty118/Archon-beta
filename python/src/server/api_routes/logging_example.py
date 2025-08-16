"""
Example API Route with Enhanced Logging

Demonstrates best practices for using the new structured logging system:
- Correlation ID propagation
- Error enrichment and context
- Performance monitoring
- Business event logging
- OpenTelemetry integration
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Dict, Any, Optional, List
import time
import asyncio

# Import our enhanced logging system
from src.server.logging.structured_logger import get_logger, alog_performance
from src.server.logging.error_enrichment import handle_errors, ErrorCategory, ErrorSeverity
from src.server.observability.opentelemetry_config import trace_span, trace_function, record_metric
from src.server.services.http_client import get_mcp_client

# Create router and logger
router = APIRouter(prefix="/api/examples", tags=["logging-examples"])
logger = get_logger(__name__)

# Example models
from pydantic import BaseModel

class ExampleRequest(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "general"

class ExampleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    category: str
    created_at: str
    processing_time_ms: float


@router.post("/basic-logging", response_model=ExampleResponse)
@alog_performance("create_example_item")
@trace_function("create_example_item", capture_args=True)
async def create_example_with_logging(
    request_data: ExampleRequest,
    request: Request
) -> ExampleResponse:
    """
    Example endpoint demonstrating comprehensive logging practices
    """
    start_time = time.time()
    
    # Log the incoming request with context
    logger.info(
        "Creating example item",
        item_name=request_data.name,
        item_category=request_data.category,
        client_ip=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent"),
        has_description=request_data.description is not None
    )
    
    try:
        # Simulate some business logic with tracing
        with trace_span("validate_request") as span:
            if span:
                span.set_attribute("item.name", request_data.name)
                span.set_attribute("item.category", request_data.category)
            
            # Validation logic
            if len(request_data.name) < 3:
                logger.security_event(
                    event_type="validation_failure",
                    severity="low",
                    details={
                        "field": "name",
                        "reason": "too_short",
                        "client_ip": request.client.host if request.client else "unknown"
                    }
                )
                raise HTTPException(
                    status_code=400,
                    detail="Name must be at least 3 characters"
                )
        
        # Simulate database operation with logging
        item_id = await _simulate_database_operation(request_data)
        
        # Simulate external service call
        await _simulate_external_service_call(item_id)
        
        # Create response
        processing_time = (time.time() - start_time) * 1000
        response = ExampleResponse(
            id=item_id,
            name=request_data.name,
            description=request_data.description,
            category=request_data.category,
            created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            processing_time_ms=processing_time
        )
        
        # Log successful business event
        logger.business_event(
            event_type="item_created",
            entity_type="example_item",
            entity_id=item_id,
            action="create",
            processing_time_ms=processing_time,
            category=request_data.category
        )
        
        # Record metrics
        record_metric("request_duration", processing_time / 1000, {
            "endpoint": "/api/examples/basic-logging",
            "method": "POST",
            "status": "success"
        })
        
        record_metric("request_count", 1, {
            "endpoint": "/api/examples/basic-logging",
            "method": "POST"
        })
        
        logger.info(
            "Example item created successfully",
            item_id=item_id,
            processing_time_ms=processing_time
        )
        
        return response
        
    except HTTPException as e:
        # HTTP exceptions are expected errors
        processing_time = (time.time() - start_time) * 1000
        
        logger.warning(
            "Example item creation failed",
            status_code=e.status_code,
            error_detail=e.detail,
            processing_time_ms=processing_time
        )
        
        record_metric("error_count", 1, {
            "endpoint": "/api/examples/basic-logging",
            "method": "POST",
            "error_type": "validation_error"
        })
        
        raise
        
    except Exception as e:
        # Unexpected errors get full context enrichment
        processing_time = (time.time() - start_time) * 1000
        
        logger.error(
            "Unexpected error creating example item",
            processing_time_ms=processing_time,
            error=e
        )
        
        record_metric("error_count", 1, {
            "endpoint": "/api/examples/basic-logging",
            "method": "POST",
            "error_type": "internal_error"
        })
        
        # Re-raise as internal server error
        raise HTTPException(
            status_code=500,
            detail="Internal server error occurred"
        )


@trace_function("simulate_database_operation")
async def _simulate_database_operation(request_data: ExampleRequest) -> str:
    """Simulate database operation with logging"""
    
    logger.info("Starting database operation")
    
    # Simulate database delay
    await asyncio.sleep(0.1)
    
    # Generate item ID
    item_id = f"item_{int(time.time() * 1000)}"
    
    # Log database operation
    logger.database_query(
        operation="INSERT",
        table="example_items",
        duration_ms=100,
        row_count=1,
        item_id=item_id
    )
    
    return item_id


@trace_function("simulate_external_service_call")
async def _simulate_external_service_call(item_id: str):
    """Simulate external service call with logging"""
    
    logger.info("Making external service call", item_id=item_id)
    
    try:
        # Use our enhanced HTTP client
        mcp_client = await get_mcp_client()
        
        # This will automatically include correlation IDs and proper logging
        response = await mcp_client.health_check()
        
        logger.info(
            "External service call completed",
            item_id=item_id,
            service_status=response.get("status", "unknown")
        )
        
    except Exception as e:
        logger.error(
            "External service call failed",
            item_id=item_id,
            error=e
        )
        # Don't reraise - this is not critical for our example


@router.get("/error-handling-demo")
@handle_errors(capture_locals=True, notify_monitoring=True)
async def demonstrate_error_handling():
    """
    Endpoint that demonstrates different types of error handling
    """
    
    logger.info("Starting error handling demonstration")
    
    # Simulate different types of errors
    error_type = "validation"  # Could be: validation, database, network, critical
    
    if error_type == "validation":
        # This will be caught and classified as a validation error
        raise ValueError("Invalid input provided for demonstration")
        
    elif error_type == "database":
        # Simulate database error
        from psycopg2 import OperationalError
        raise OperationalError("Database connection failed")
        
    elif error_type == "network":
        # Simulate network error
        import aiohttp
        raise aiohttp.ClientConnectionError("Failed to connect to external service")
        
    elif error_type == "critical":
        # Simulate critical system error
        raise MemoryError("System running out of memory")
    
    return {"status": "success"}


@router.get("/performance-monitoring")
async def demonstrate_performance_monitoring():
    """
    Endpoint demonstrating performance monitoring and metrics
    """
    start_time = time.time()
    
    logger.info("Starting performance monitoring demonstration")
    
    # Multiple operations with individual timing
    operations = []
    
    # Operation 1: Fast operation
    with trace_span("fast_operation") as span:
        await asyncio.sleep(0.05)  # 50ms
        operations.append({"name": "fast_operation", "duration_ms": 50})
        if span:
            span.set_attribute("operation.type", "fast")
    
    # Operation 2: Medium operation  
    with trace_span("medium_operation") as span:
        await asyncio.sleep(0.2)  # 200ms
        operations.append({"name": "medium_operation", "duration_ms": 200})
        if span:
            span.set_attribute("operation.type", "medium")
    
    # Operation 3: Slow operation
    with trace_span("slow_operation") as span:
        await asyncio.sleep(0.5)  # 500ms
        operations.append({"name": "slow_operation", "duration_ms": 500})
        if span:
            span.set_attribute("operation.type", "slow")
    
    total_time = (time.time() - start_time) * 1000
    
    # Record performance metrics
    record_metric("request_duration", total_time / 1000, {
        "endpoint": "/api/examples/performance-monitoring",
        "operation_count": len(operations)
    })
    
    for operation in operations:
        record_metric("operation_duration", operation["duration_ms"] / 1000, {
            "operation_name": operation["name"]
        })
    
    logger.info(
        "Performance monitoring demonstration completed",
        total_duration_ms=total_time,
        operation_count=len(operations),
        operations=operations
    )
    
    return {
        "total_duration_ms": total_time,
        "operations": operations,
        "performance_notes": [
            "All operations traced with OpenTelemetry",
            "Metrics recorded for monitoring",
            "Structured logs include timing data"
        ]
    }


@router.get("/cache-operations")
async def demonstrate_cache_logging():
    """
    Endpoint demonstrating cache operation logging
    """
    
    logger.info("Starting cache operations demonstration")
    
    # Simulate cache operations with proper logging
    cache_operations = [
        {"key": "user:123", "operation": "GET", "hit": True, "duration_ms": 2.5},
        {"key": "config:settings", "operation": "SET", "hit": False, "duration_ms": 15.0},
        {"key": "session:abc123", "operation": "DELETE", "hit": True, "duration_ms": 1.2}
    ]
    
    for operation in cache_operations:
        logger.cache_operation(
            operation=operation["operation"],
            key=operation["key"],
            hit=operation["hit"],
            duration_ms=operation["duration_ms"]
        )
        
        # Record cache metrics
        record_metric("cache_operations", 1, {
            "operation": operation["operation"].lower(),
            "hit": str(operation["hit"]).lower()
        })
    
    logger.info(
        "Cache operations demonstration completed",
        total_operations=len(cache_operations)
    )
    
    return {
        "cache_operations": cache_operations,
        "total_operations": len(cache_operations)
    }


@router.get("/health-with-logging")
async def health_check_with_comprehensive_logging():
    """
    Health check endpoint with comprehensive logging for monitoring
    """
    
    logger.info("Health check requested")
    
    # Check various system components
    health_status = {
        "status": "healthy",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "components": {}
    }
    
    # Check database (simulated)
    with trace_span("health_check_database") as span:
        db_healthy = True  # Simulate check
        health_status["components"]["database"] = {
            "status": "healthy" if db_healthy else "unhealthy",
            "response_time_ms": 25.0
        }
        if span:
            span.set_attribute("component", "database")
            span.set_attribute("healthy", db_healthy)
    
    # Check cache (simulated)
    with trace_span("health_check_cache") as span:
        cache_healthy = True  # Simulate check
        health_status["components"]["cache"] = {
            "status": "healthy" if cache_healthy else "unhealthy",
            "response_time_ms": 5.0
        }
        if span:
            span.set_attribute("component", "cache")
            span.set_attribute("healthy", cache_healthy)
    
    # Check external services (simulated)
    with trace_span("health_check_external") as span:
        external_healthy = True  # Simulate check
        health_status["components"]["external_services"] = {
            "status": "healthy" if external_healthy else "unhealthy",
            "response_time_ms": 150.0
        }
        if span:
            span.set_attribute("component", "external_services")
            span.set_attribute("healthy", external_healthy)
    
    # Overall health
    all_healthy = all(
        comp["status"] == "healthy" 
        for comp in health_status["components"].values()
    )
    
    if not all_healthy:
        health_status["status"] = "degraded"
    
    # Log health check results
    logger.info(
        "Health check completed",
        overall_status=health_status["status"],
        component_count=len(health_status["components"]),
        all_healthy=all_healthy
    )
    
    # Record health metrics
    record_metric("health_check_count", 1, {
        "status": health_status["status"]
    })
    
    for component, status in health_status["components"].items():
        record_metric("component_health", 1 if status["status"] == "healthy" else 0, {
            "component": component
        })
    
    return health_status