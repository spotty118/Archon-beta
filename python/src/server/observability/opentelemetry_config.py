"""
OpenTelemetry Configuration for Archon V2 Beta

Advanced observability with distributed tracing, metrics, and logs:
- Automatic instrumentation for FastAPI, aiohttp, and database operations
- Custom spans for business logic and performance tracking
- Integration with Jaeger, Prometheus, and logging systems
- Performance monitoring with Core Web Vitals equivalent for APIs
"""

import os
import time
from typing import Dict, Any, Optional, List
from contextlib import contextmanager
from functools import wraps

# OpenTelemetry imports
from opentelemetry import trace, metrics, baggage
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource

# Exporters
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.exporter.prometheus import PrometheusMetricReader
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter

# Instrumentation
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.aiohttp_client import AioHttpClientInstrumentor
from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor

# Semantic conventions
from opentelemetry.semconv.trace import SpanAttributes
from opentelemetry.semconv.resource import ResourceAttributes

from src.server.logging.structured_logger import get_logger

logger = get_logger(__name__)


class OpenTelemetryConfig:
    """OpenTelemetry configuration and setup"""
    
    def __init__(self):
        self.tracer_provider: Optional[TracerProvider] = None
        self.meter_provider: Optional[MeterProvider] = None
        self.tracer = None
        self.meter = None
        self.enabled = os.getenv("OTEL_ENABLED", "false").lower() == "true"
        
        # Configuration from environment
        self.service_name = os.getenv("OTEL_SERVICE_NAME", "archon-api")
        self.service_version = os.getenv("OTEL_SERVICE_VERSION", "2.0.0-beta")
        self.environment = os.getenv("ENVIRONMENT", "development")
        
        # Exporter configuration
        self.jaeger_endpoint = os.getenv("JAEGER_ENDPOINT", "http://localhost:14268/api/traces")
        self.otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
        self.prometheus_port = int(os.getenv("PROMETHEUS_PORT", "8000"))
        
        # Metrics
        self._metrics = {}
        
    def setup_telemetry(self) -> bool:
        """Setup OpenTelemetry tracing and metrics"""
        if not self.enabled:
            logger.info("OpenTelemetry disabled via OTEL_ENABLED=false")
            return False
        
        try:
            # Setup resource
            resource = Resource.create({
                ResourceAttributes.SERVICE_NAME: self.service_name,
                ResourceAttributes.SERVICE_VERSION: self.service_version,
                ResourceAttributes.DEPLOYMENT_ENVIRONMENT: self.environment,
                "service.instance.id": f"{self.service_name}-{int(time.time())}",
            })
            
            # Setup tracing
            self._setup_tracing(resource)
            
            # Setup metrics
            self._setup_metrics(resource)
            
            # Setup automatic instrumentation
            self._setup_auto_instrumentation()
            
            logger.info(
                "OpenTelemetry initialized",
                service_name=self.service_name,
                service_version=self.service_version,
                environment=self.environment,
                jaeger_endpoint=self.jaeger_endpoint,
                otlp_endpoint=self.otlp_endpoint
            )
            
            return True
            
        except Exception as e:
            logger.error("Failed to setup OpenTelemetry", error=e)
            return False
    
    def _setup_tracing(self, resource: Resource):
        """Setup distributed tracing"""
        # Create tracer provider
        self.tracer_provider = TracerProvider(resource=resource)
        
        # Setup exporters
        exporters = []
        
        # Jaeger exporter for development
        if self.jaeger_endpoint:
            try:
                jaeger_exporter = JaegerExporter(
                    endpoint=self.jaeger_endpoint,
                    max_tag_value_length=1000
                )
                exporters.append(jaeger_exporter)
                logger.debug("Jaeger exporter configured")
            except Exception as e:
                logger.warning("Failed to setup Jaeger exporter", error=e)
        
        # OTLP exporter for production
        if self.otlp_endpoint:
            try:
                otlp_exporter = OTLPSpanExporter(
                    endpoint=f"{self.otlp_endpoint}/v1/traces"
                )
                exporters.append(otlp_exporter)
                logger.debug("OTLP trace exporter configured")
            except Exception as e:
                logger.warning("Failed to setup OTLP trace exporter", error=e)
        
        # Add span processors
        for exporter in exporters:
            span_processor = BatchSpanProcessor(
                exporter,
                max_export_batch_size=512,
                export_timeout_millis=30000,
                max_queue_size=2048
            )
            self.tracer_provider.add_span_processor(span_processor)
        
        # Set global tracer provider
        trace.set_tracer_provider(self.tracer_provider)
        self.tracer = trace.get_tracer(__name__)
    
    def _setup_metrics(self, resource: Resource):
        """Setup metrics collection and export"""
        readers = []
        
        # Prometheus metrics reader
        try:
            prometheus_reader = PrometheusMetricReader(port=self.prometheus_port)
            readers.append(prometheus_reader)
            logger.debug(f"Prometheus metrics reader configured on port {self.prometheus_port}")
        except Exception as e:
            logger.warning("Failed to setup Prometheus metrics reader", error=e)
        
        # OTLP metrics exporter
        if self.otlp_endpoint:
            try:
                otlp_metrics_exporter = OTLPMetricExporter(
                    endpoint=f"{self.otlp_endpoint}/v1/metrics"
                )
                otlp_reader = PeriodicExportingMetricReader(
                    exporter=otlp_metrics_exporter,
                    export_interval_millis=30000  # 30 seconds
                )
                readers.append(otlp_reader)
                logger.debug("OTLP metrics exporter configured")
            except Exception as e:
                logger.warning("Failed to setup OTLP metrics exporter", error=e)
        
        # Create meter provider
        self.meter_provider = MeterProvider(
            resource=resource,
            metric_readers=readers
        )
        
        # Set global meter provider
        metrics.set_meter_provider(self.meter_provider)
        self.meter = metrics.get_meter(__name__)
        
        # Create standard metrics
        self._create_standard_metrics()
    
    def _create_standard_metrics(self):
        """Create standard application metrics"""
        if not self.meter:
            return
        
        # Request metrics
        self._metrics["request_duration"] = self.meter.create_histogram(
            name="archon_request_duration_seconds",
            description="Request duration in seconds",
            unit="s"
        )
        
        self._metrics["request_count"] = self.meter.create_counter(
            name="archon_requests_total",
            description="Total number of requests"
        )
        
        self._metrics["error_count"] = self.meter.create_counter(
            name="archon_errors_total",
            description="Total number of errors"
        )
        
        # Database metrics
        self._metrics["db_query_duration"] = self.meter.create_histogram(
            name="archon_db_query_duration_seconds",
            description="Database query duration in seconds",
            unit="s"
        )
        
        self._metrics["db_connection_pool"] = self.meter.create_up_down_counter(
            name="archon_db_connections_active",
            description="Active database connections"
        )
        
        # Cache metrics
        self._metrics["cache_operations"] = self.meter.create_counter(
            name="archon_cache_operations_total",
            description="Total cache operations"
        )
        
        self._metrics["cache_hit_ratio"] = self.meter.create_histogram(
            name="archon_cache_hit_ratio",
            description="Cache hit ratio"
        )
        
        # Business metrics
        self._metrics["knowledge_items"] = self.meter.create_up_down_counter(
            name="archon_knowledge_items_total",
            description="Total knowledge items"
        )
        
        self._metrics["projects"] = self.meter.create_up_down_counter(
            name="archon_projects_total", 
            description="Total projects"
        )
        
        self._metrics["tasks"] = self.meter.create_up_down_counter(
            name="archon_tasks_total",
            description="Total tasks"
        )
        
        logger.debug("Standard metrics created")
    
    def _setup_auto_instrumentation(self):
        """Setup automatic instrumentation for common libraries"""
        try:
            # FastAPI instrumentation
            FastAPIInstrumentor.instrument()
            logger.debug("FastAPI instrumentation enabled")
        except Exception as e:
            logger.warning("Failed to instrument FastAPI", error=e)
        
        try:
            # aiohttp client instrumentation
            AioHttpClientInstrumentor().instrument()
            logger.debug("aiohttp client instrumentation enabled")
        except Exception as e:
            logger.warning("Failed to instrument aiohttp client", error=e)
        
        try:
            # AsyncPG instrumentation
            AsyncPGInstrumentor().instrument()
            logger.debug("AsyncPG instrumentation enabled")
        except Exception as e:
            logger.warning("Failed to instrument AsyncPG", error=e)
        
        try:
            # Redis instrumentation
            RedisInstrumentor().instrument()
            logger.debug("Redis instrumentation enabled")
        except Exception as e:
            logger.warning("Failed to instrument Redis", error=e)
        
        try:
            # Requests instrumentation (for external APIs)
            RequestsInstrumentor().instrument()
            logger.debug("Requests instrumentation enabled")
        except Exception as e:
            logger.warning("Failed to instrument Requests", error=e)
    
    def record_metric(self, metric_name: str, value: float, attributes: Optional[Dict[str, Any]] = None):
        """Record a metric value"""
        if not self.enabled or metric_name not in self._metrics:
            return
        
        try:
            metric = self._metrics[metric_name]
            if hasattr(metric, 'record'):
                metric.record(value, attributes or {})
            elif hasattr(metric, 'add'):
                metric.add(value, attributes or {})
        except Exception as e:
            logger.warning(f"Failed to record metric {metric_name}", error=e)
    
    def get_tracer(self):
        """Get the configured tracer"""
        return self.tracer
    
    def get_meter(self):
        """Get the configured meter"""
        return self.meter


# Global telemetry instance
telemetry = OpenTelemetryConfig()


def setup_opentelemetry() -> bool:
    """Setup OpenTelemetry for the application"""
    return telemetry.setup_telemetry()


def get_tracer():
    """Get the global tracer instance"""
    return telemetry.get_tracer()


def get_meter():
    """Get the global meter instance"""
    return telemetry.get_meter()


@contextmanager
def trace_span(name: str, attributes: Optional[Dict[str, Any]] = None):
    """Context manager for creating custom spans"""
    if not telemetry.enabled or not telemetry.tracer:
        yield None
        return
    
    with telemetry.tracer.start_as_current_span(name) as span:
        if attributes:
            for key, value in attributes.items():
                span.set_attribute(key, value)
        yield span


def trace_function(
    operation_name: Optional[str] = None,
    capture_args: bool = False,
    capture_result: bool = False
):
    """Decorator to automatically trace function calls"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not telemetry.enabled:
                return func(*args, **kwargs)
            
            span_name = operation_name or f"{func.__module__}.{func.__name__}"
            
            with trace_span(span_name) as span:
                if span and capture_args:
                    # Capture function arguments (be careful with sensitive data)
                    span.set_attribute("function.args_count", len(args))
                    span.set_attribute("function.kwargs_count", len(kwargs))
                
                start_time = time.time()
                try:
                    result = func(*args, **kwargs)
                    
                    if span:
                        span.set_attribute("function.success", True)
                        if capture_result and result is not None:
                            span.set_attribute("function.result_type", type(result).__name__)
                    
                    return result
                    
                except Exception as e:
                    if span:
                        span.set_attribute("function.success", False)
                        span.set_attribute("function.error_type", type(e).__name__)
                        span.set_attribute("function.error_message", str(e))
                    raise
                finally:
                    if span:
                        duration = time.time() - start_time
                        span.set_attribute("function.duration_seconds", duration)
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            if not telemetry.enabled:
                return await func(*args, **kwargs)
            
            span_name = operation_name or f"{func.__module__}.{func.__name__}"
            
            with trace_span(span_name) as span:
                if span and capture_args:
                    span.set_attribute("function.args_count", len(args))
                    span.set_attribute("function.kwargs_count", len(kwargs))
                
                start_time = time.time()
                try:
                    result = await func(*args, **kwargs)
                    
                    if span:
                        span.set_attribute("function.success", True)
                        if capture_result and result is not None:
                            span.set_attribute("function.result_type", type(result).__name__)
                    
                    return result
                    
                except Exception as e:
                    if span:
                        span.set_attribute("function.success", False)
                        span.set_attribute("function.error_type", type(e).__name__)
                        span.set_attribute("function.error_message", str(e))
                    raise
                finally:
                    if span:
                        duration = time.time() - start_time
                        span.set_attribute("function.duration_seconds", duration)
        
        # Return appropriate wrapper based on function type
        if hasattr(func, '__code__') and func.__code__.co_flags & 0x80:  # Check if async
            return async_wrapper
        else:
            return wrapper
    
    return decorator


def record_metric(metric_name: str, value: float, attributes: Optional[Dict[str, Any]] = None):
    """Record a metric value"""
    telemetry.record_metric(metric_name, value, attributes)


def set_baggage(key: str, value: str):
    """Set baggage for request context"""
    if telemetry.enabled:
        baggage.set_baggage(key, value)


def get_baggage(key: str) -> Optional[str]:
    """Get baggage from request context"""
    if telemetry.enabled:
        return baggage.get_baggage(key)
    return None


__all__ = [
    'OpenTelemetryConfig',
    'telemetry',
    'setup_opentelemetry',
    'get_tracer',
    'get_meter',
    'trace_span',
    'trace_function',
    'record_metric',
    'set_baggage',
    'get_baggage'
]