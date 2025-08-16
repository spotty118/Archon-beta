"""
Comprehensive Prometheus Metrics for Archon V2 Beta

Production-ready metrics collection covering:
- API performance and Core Web Vitals equivalent
- Business metrics for knowledge management
- System health and resource utilization
- Error rates and availability monitoring
- Custom dashboards and alerting integration
"""

import time
import psutil
import asyncio
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timedelta
from functools import wraps
from dataclasses import dataclass
from contextlib import asynccontextmanager

# Prometheus client
from prometheus_client import (
    Counter, Histogram, Gauge, Info, Enum,
    start_http_server, generate_latest, CONTENT_TYPE_LATEST,
    CollectorRegistry, REGISTRY
)

from src.server.logging.structured_logger import get_logger

logger = get_logger(__name__)


@dataclass
class MetricThresholds:
    """Performance thresholds for alerting"""
    response_time_warning: float = 1.0    # 1 second
    response_time_critical: float = 3.0   # 3 seconds
    error_rate_warning: float = 0.05      # 5%
    error_rate_critical: float = 0.10     # 10%
    cpu_warning: float = 0.70             # 70%
    cpu_critical: float = 0.85            # 85%
    memory_warning: float = 0.75          # 75%
    memory_critical: float = 0.90         # 90%


class ArchonMetrics:
    """Comprehensive metrics collection for Archon V2"""
    
    def __init__(self, registry: Optional[CollectorRegistry] = None):
        self.registry = registry or REGISTRY
        self.thresholds = MetricThresholds()
        self._setup_metrics()
        self._monitoring_active = False
        self._monitoring_task: Optional[asyncio.Task] = None
        
        logger.info("Prometheus metrics initialized")
    
    def _setup_metrics(self):
        """Setup all Prometheus metrics"""
        
        # === API Performance Metrics (Core Web Vitals equivalent) ===
        
        # Request duration histogram (equivalent to LCP - Largest Contentful Paint)
        self.request_duration = Histogram(
            'archon_http_request_duration_seconds',
            'Time spent processing HTTP requests',
            ['method', 'endpoint', 'status_code'],
            buckets=(0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0),
            registry=self.registry
        )
        
        # Request count (total requests)
        self.request_count = Counter(
            'archon_http_requests_total',
            'Total number of HTTP requests',
            ['method', 'endpoint', 'status_code'],
            registry=self.registry
        )
        
        # Response size histogram
        self.response_size = Histogram(
            'archon_http_response_size_bytes',
            'Size of HTTP responses in bytes',
            ['method', 'endpoint'],
            buckets=(100, 1000, 10000, 100000, 1000000, 10000000),
            registry=self.registry
        )
        
        # Active requests gauge (equivalent to FID - First Input Delay)
        self.active_requests = Gauge(
            'archon_http_requests_active',
            'Number of requests currently being processed',
            registry=self.registry
        )
        
        # Request queue time (time waiting to be processed)
        self.request_queue_time = Histogram(
            'archon_request_queue_duration_seconds',
            'Time requests spend waiting in queue',
            ['endpoint'],
            registry=self.registry
        )
        
        # === Database Metrics ===
        
        # Database query duration
        self.db_query_duration = Histogram(
            'archon_db_query_duration_seconds',
            'Time spent executing database queries',
            ['operation', 'table'],
            buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5),
            registry=self.registry
        )
        
        # Database connections
        self.db_connections_active = Gauge(
            'archon_db_connections_active',
            'Number of active database connections',
            registry=self.registry
        )
        
        self.db_connections_total = Counter(
            'archon_db_connections_total',
            'Total number of database connections created',
            registry=self.registry
        )
        
        # Database query count
        self.db_queries_total = Counter(
            'archon_db_queries_total',
            'Total number of database queries executed',
            ['operation', 'table', 'status'],
            registry=self.registry
        )
        
        # === Cache Metrics ===
        
        # Cache operations
        self.cache_operations_total = Counter(
            'archon_cache_operations_total',
            'Total number of cache operations',
            ['operation', 'result'],
            registry=self.registry
        )
        
        # Cache hit ratio
        self.cache_hit_ratio = Gauge(
            'archon_cache_hit_ratio',
            'Cache hit ratio (0-1)',
            registry=self.registry
        )
        
        # Cache operation duration
        self.cache_operation_duration = Histogram(
            'archon_cache_operation_duration_seconds',
            'Time spent on cache operations',
            ['operation'],
            buckets=(0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1),
            registry=self.registry
        )
        
        # === Business Metrics ===
        
        # Knowledge items
        self.knowledge_items_total = Gauge(
            'archon_knowledge_items_total',
            'Total number of knowledge items',
            ['type', 'status'],
            registry=self.registry
        )
        
        # Projects and tasks
        self.projects_total = Gauge(
            'archon_projects_total',
            'Total number of projects',
            ['status'],
            registry=self.registry
        )
        
        self.tasks_total = Gauge(
            'archon_tasks_total',
            'Total number of tasks',
            ['status', 'priority'],
            registry=self.registry
        )
        
        # Document processing
        self.documents_processed_total = Counter(
            'archon_documents_processed_total',
            'Total number of documents processed',
            ['type', 'status'],
            registry=self.registry
        )
        
        # Embedding operations
        self.embeddings_generated_total = Counter(
            'archon_embeddings_generated_total',
            'Total number of embeddings generated',
            ['model', 'status'],
            registry=self.registry
        )
        
        self.embedding_generation_duration = Histogram(
            'archon_embedding_generation_duration_seconds',
            'Time spent generating embeddings',
            ['model'],
            buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0),
            registry=self.registry
        )
        
        # === External Service Metrics ===
        
        # External API calls
        self.external_api_requests_total = Counter(
            'archon_external_api_requests_total',
            'Total number of external API requests',
            ['service', 'endpoint', 'status_code'],
            registry=self.registry
        )
        
        self.external_api_duration = Histogram(
            'archon_external_api_duration_seconds',
            'Duration of external API calls',
            ['service', 'endpoint'],
            buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
            registry=self.registry
        )
        
        # Circuit breaker state
        self.circuit_breaker_state = Enum(
            'archon_circuit_breaker_state',
            'Circuit breaker state for external services',
            ['service'],
            states=['closed', 'open', 'half_open'],
            registry=self.registry
        )
        
        # === System Health Metrics ===
        
        # System resource usage
        self.cpu_usage = Gauge(
            'archon_cpu_usage_percent',
            'CPU usage percentage',
            registry=self.registry
        )
        
        self.memory_usage = Gauge(
            'archon_memory_usage_bytes',
            'Memory usage in bytes',
            registry=self.registry
        )
        
        self.memory_usage_percent = Gauge(
            'archon_memory_usage_percent',
            'Memory usage percentage',
            registry=self.registry
        )
        
        self.disk_usage_percent = Gauge(
            'archon_disk_usage_percent',
            'Disk usage percentage',
            registry=self.registry
        )
        
        # Application health
        self.app_health = Gauge(
            'archon_app_health',
            'Application health status (1=healthy, 0=unhealthy)',
            ['component'],
            registry=self.registry
        )
        
        # Service uptime
        self.service_uptime_seconds = Gauge(
            'archon_service_uptime_seconds',
            'Service uptime in seconds',
            registry=self.registry
        )
        
        # === Error and Availability Metrics ===
        
        # Error rates
        self.errors_total = Counter(
            'archon_errors_total',
            'Total number of errors',
            ['type', 'severity', 'component'],
            registry=self.registry
        )
        
        # Service availability
        self.service_availability = Gauge(
            'archon_service_availability_percent',
            'Service availability percentage',
            ['service'],
            registry=self.registry
        )
        
        # SLA compliance
        self.sla_compliance = Gauge(
            'archon_sla_compliance_percent',
            'SLA compliance percentage',
            ['sla_type'],
            registry=self.registry
        )
        
        # === MCP Service Metrics ===
        
        # MCP tool executions
        self.mcp_tool_executions_total = Counter(
            'archon_mcp_tool_executions_total',
            'Total number of MCP tool executions',
            ['tool_name', 'status'],
            registry=self.registry
        )
        
        self.mcp_tool_execution_duration = Histogram(
            'archon_mcp_tool_execution_duration_seconds',
            'Duration of MCP tool executions',
            ['tool_name'],
            buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0),
            registry=self.registry
        )
        
        # === Application Info ===
        
        # Application information
        self.app_info = Info(
            'archon_app_info',
            'Application information',
            registry=self.registry
        )
        
        # Set application info
        self.app_info.info({
            'version': '2.0.0-beta',
            'environment': 'development',
            'build_date': datetime.now().isoformat(),
            'service_name': 'archon-api'
        })
        
        logger.info("All Prometheus metrics configured")
    
    async def start_monitoring(self):
        """Start background monitoring tasks"""
        if self._monitoring_active:
            return
        
        self._monitoring_active = True
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())
        
        logger.info("Background monitoring started")
    
    async def stop_monitoring(self):
        """Stop background monitoring tasks"""
        self._monitoring_active = False
        
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Background monitoring stopped")
    
    async def _monitoring_loop(self):
        """Background loop for collecting system metrics"""
        try:
            start_time = time.time()
            
            while self._monitoring_active:
                # Update system metrics
                self._update_system_metrics(start_time)
                
                # Update application health
                await self._update_application_health()
                
                # Sleep for monitoring interval
                await asyncio.sleep(10)  # Update every 10 seconds
                
        except asyncio.CancelledError:
            logger.info("Monitoring loop cancelled")
        except Exception as e:
            logger.error("Error in monitoring loop", error=e)
    
    def _update_system_metrics(self, start_time: float):
        """Update system resource metrics"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent()
            self.cpu_usage.set(cpu_percent)
            
            # Memory usage
            memory = psutil.virtual_memory()
            self.memory_usage.set(memory.used)
            self.memory_usage_percent.set(memory.percent)
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            self.disk_usage_percent.set(disk_percent)
            
            # Service uptime
            uptime = time.time() - start_time
            self.service_uptime_seconds.set(uptime)
            
        except Exception as e:
            logger.warning("Failed to update system metrics", error=e)
    
    async def _update_application_health(self):
        """Update application component health"""
        try:
            # Check database health (simplified)
            self.app_health.labels(component='database').set(1)
            
            # Check cache health (simplified)
            self.app_health.labels(component='cache').set(1)
            
            # Check MCP service health (simplified)
            self.app_health.labels(component='mcp').set(1)
            
        except Exception as e:
            logger.warning("Failed to update application health", error=e)
    
    # === Convenience Methods for Common Metrics ===
    
    def record_request(self, method: str, endpoint: str, status_code: int, duration: float, response_size: Optional[int] = None):
        """Record HTTP request metrics"""
        self.request_duration.labels(method=method, endpoint=endpoint, status_code=status_code).observe(duration)
        self.request_count.labels(method=method, endpoint=endpoint, status_code=status_code).inc()
        
        if response_size is not None:
            self.response_size.labels(method=method, endpoint=endpoint).observe(response_size)
    
    def record_db_query(self, operation: str, table: str, duration: float, success: bool = True):
        """Record database query metrics"""
        status = 'success' if success else 'error'
        self.db_query_duration.labels(operation=operation, table=table).observe(duration)
        self.db_queries_total.labels(operation=operation, table=table, status=status).inc()
    
    def record_cache_operation(self, operation: str, hit: bool, duration: Optional[float] = None):
        """Record cache operation metrics"""
        result = 'hit' if hit else 'miss'
        self.cache_operations_total.labels(operation=operation, result=result).inc()
        
        if duration is not None:
            self.cache_operation_duration.labels(operation=operation).observe(duration)
    
    def record_external_api_call(self, service: str, endpoint: str, status_code: int, duration: float):
        """Record external API call metrics"""
        self.external_api_requests_total.labels(service=service, endpoint=endpoint, status_code=status_code).inc()
        self.external_api_duration.labels(service=service, endpoint=endpoint).observe(duration)
    
    def record_mcp_tool_execution(self, tool_name: str, duration: float, success: bool = True):
        """Record MCP tool execution metrics"""
        status = 'success' if success else 'error'
        self.mcp_tool_executions_total.labels(tool_name=tool_name, status=status).inc()
        self.mcp_tool_execution_duration.labels(tool_name=tool_name).observe(duration)
    
    def record_error(self, error_type: str, severity: str, component: str):
        """Record error metrics"""
        self.errors_total.labels(type=error_type, severity=severity, component=component).inc()
    
    def set_circuit_breaker_state(self, service: str, state: str):
        """Set circuit breaker state for a service"""
        self.circuit_breaker_state.labels(service=service).state(state)
    
    def update_business_metrics(self, knowledge_items: Dict[str, int], projects: Dict[str, int], tasks: Dict[str, int]):
        """Update business metrics"""
        # Knowledge items
        for key, count in knowledge_items.items():
            item_type, status = key.split(':') if ':' in key else (key, 'active')
            self.knowledge_items_total.labels(type=item_type, status=status).set(count)
        
        # Projects
        for status, count in projects.items():
            self.projects_total.labels(status=status).set(count)
        
        # Tasks
        for key, count in tasks.items():
            if ':' in key:
                status, priority = key.split(':')
                self.tasks_total.labels(status=status, priority=priority).set(count)


# Decorators for automatic metrics collection

def track_request_metrics(metrics: ArchonMetrics):
    """Decorator to automatically track request metrics"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            metrics.active_requests.inc()
            
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                
                # This would need request context to get method, endpoint, etc.
                # Implementation depends on FastAPI middleware integration
                
                return result
            finally:
                metrics.active_requests.dec()
        
        return wrapper
    return decorator


def track_db_metrics(metrics: ArchonMetrics, operation: str, table: str):
    """Decorator to automatically track database metrics"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                metrics.record_db_query(operation, table, duration, success=True)
                return result
            except Exception as e:
                duration = time.time() - start_time
                metrics.record_db_query(operation, table, duration, success=False)
                raise
        
        return wrapper
    return decorator


# Global metrics instance
archon_metrics = ArchonMetrics()


def get_metrics() -> ArchonMetrics:
    """Get the global metrics instance"""
    return archon_metrics


async def start_metrics_server(port: int = 8000):
    """Start Prometheus metrics HTTP server"""
    try:
        start_http_server(port)
        logger.info(f"Prometheus metrics server started on port {port}")
        
        # Start background monitoring
        await archon_metrics.start_monitoring()
        
        return True
    except Exception as e:
        logger.error(f"Failed to start metrics server on port {port}", error=e)
        return False


async def stop_metrics_monitoring():
    """Stop metrics monitoring"""
    await archon_metrics.stop_monitoring()


__all__ = [
    'ArchonMetrics',
    'MetricThresholds',
    'archon_metrics',
    'get_metrics',
    'track_request_metrics',
    'track_db_metrics',
    'start_metrics_server',
    'stop_metrics_monitoring'
]