# Archon V2 Beta - Structured Logging & Observability

Comprehensive logging, tracing, and monitoring infrastructure for production-ready observability.

## 🚀 Features

### **Structured Logging**
- **JSON Format**: All logs in structured JSON for better parsing and analysis
- **Correlation IDs**: Automatic request tracing across microservices
- **Context Variables**: User ID, request path, and custom context propagation
- **Performance Metrics**: Built-in timing and resource usage tracking

### **Error Enrichment**
- **Automatic Classification**: Errors categorized by type and severity
- **Context Capture**: Local variables, stack traces, and system information
- **Pattern Detection**: Track recurring error patterns for analysis
- **Integration Ready**: Built for Sentry, DataDog, and other monitoring systems

### **Distributed Tracing**
- **OpenTelemetry Integration**: Industry-standard distributed tracing
- **Automatic Instrumentation**: FastAPI, aiohttp, database, and Redis
- **Custom Spans**: Business logic and performance tracking
- **Multiple Exporters**: Jaeger (development) and OTLP (production)

### **Metrics & Monitoring**
- **Prometheus Integration**: Built-in metrics export
- **Business Metrics**: Track knowledge items, projects, tasks
- **Performance Metrics**: Request duration, database queries, cache operations
- **Health Monitoring**: Component health and availability tracking

## 📋 Quick Start

### 1. Basic Logging

```python
from src.server.logging.structured_logger import get_logger

logger = get_logger(__name__)

# Simple logging with context
logger.info("User logged in", user_id="123", ip_address="192.168.1.1")

# Error logging with exception context
try:
    risky_operation()
except Exception as e:
    logger.error("Operation failed", error=e, user_id="123")
```

### 2. Performance Monitoring

```python
from src.server.logging.structured_logger import alog_performance

@alog_performance("create_knowledge_item")
async def create_item(data):
    # Automatically logs duration and success/failure
    return await database.create(data)
```

### 3. Distributed Tracing

```python
from src.server.observability.opentelemetry_config import trace_span, trace_function

@trace_function("business_operation", capture_args=True)
async def complex_operation(item_id: str):
    with trace_span("validation") as span:
        if span:
            span.set_attribute("item.id", item_id)
        validate_item(item_id)
    
    with trace_span("database_operation") as span:
        result = await database.update(item_id)
        if span:
            span.set_attribute("rows_affected", result.rowcount)
    
    return result
```

### 4. Error Handling with Context

```python
from src.server.logging.error_enrichment import handle_errors

@handle_errors(capture_locals=True, notify_monitoring=True)
async def critical_operation():
    # Automatic error enrichment with local variables and system context
    return await perform_operation()
```

## 🏗️ Architecture

### Core Components

#### **1. StructuredLogger (`structured_logger.py`)**
- Enhanced logger with correlation ID support
- Specialized logging methods for different event types
- Context variable management for request tracing

#### **2. CorrelationMiddleware (`correlation_middleware.py`)**
- FastAPI middleware for automatic correlation ID injection
- Request timing and security audit logging
- Header propagation for microservices communication

#### **3. ErrorEnricher (`error_enrichment.py`)**
- Automatic error classification and severity assessment
- Context enrichment with system and request information
- Pattern detection and monitoring integration

#### **4. OpenTelemetry Config (`opentelemetry_config.py`)**
- Distributed tracing setup and configuration
- Automatic instrumentation for common libraries
- Metrics collection and export

#### **5. TracingHTTPClient (`http_client.py`)**
- HTTP client with automatic correlation ID propagation
- Circuit breaker pattern for resilience
- Connection pooling and retry logic

## 📊 Log Structure

### Standard Log Format

```json
{
  "timestamp": "2025-08-16T16:30:45.123Z",
  "level": "INFO",
  "logger": "src.server.api_routes.knowledge_api",
  "message": "Knowledge item created successfully",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user123",
  "request_path": "POST /api/knowledge-items",
  "service": "archon-api",
  "version": "2.0.0-beta",
  "environment": "production",
  "duration_ms": 245.5,
  "extra": {
    "item_id": "item_456",
    "category": "documentation",
    "processing_time_ms": 245.5
  }
}
```

### Error Log with Context

```json
{
  "timestamp": "2025-08-16T16:30:45.123Z",
  "level": "ERROR",
  "logger": "src.server.services.knowledge_service",
  "message": "Failed to create knowledge item",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user123",
  "error_type": "ValidationError",
  "error_message": "Title must be at least 3 characters",
  "error_category": "validation",
  "severity": "low",
  "stack_trace": "Traceback (most recent call last)...",
  "error_location": {
    "file": "/app/src/server/services/knowledge_service.py",
    "function": "create_item",
    "line_number": 45,
    "module": "src.server.services.knowledge_service"
  },
  "local_variables": {
    "title": "AB",
    "user_id": "user123",
    "category": "documentation"
  },
  "system_info": {
    "cpu_percent": 25.4,
    "memory_percent": 62.1,
    "disk_usage_percent": 45.2
  }
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Structured Logging
LOG_LEVEL=INFO                    # DEBUG, INFO, WARNING, ERROR, CRITICAL
CORRELATION_ID_HEADER=X-Correlation-ID

# OpenTelemetry
OTEL_ENABLED=true                 # Enable/disable tracing
OTEL_SERVICE_NAME=archon-api
OTEL_SERVICE_VERSION=2.0.0-beta
ENVIRONMENT=production

# Exporters
JAEGER_ENDPOINT=http://localhost:14268/api/traces
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
PROMETHEUS_PORT=8000

# Error Handling
ERROR_CAPTURE_LOCALS=true        # Capture local variables in errors
ERROR_NOTIFY_MONITORING=true     # Send errors to monitoring systems
```

### FastAPI Integration

The logging system is automatically integrated into your FastAPI application:

```python
# In main.py - this is already configured
from src.server.middleware.correlation_middleware import add_correlation_middleware
from src.server.observability.opentelemetry_config import setup_opentelemetry

# Add correlation middleware
add_correlation_middleware(app)

# Setup OpenTelemetry (optional)
setup_opentelemetry()
```

## 📈 Monitoring Integration

### Prometheus Metrics

Automatic metrics collection for:

- **Request Metrics**: Duration, count, error rate
- **Database Metrics**: Query duration, connection pool usage
- **Cache Metrics**: Operations, hit ratio
- **Business Metrics**: Knowledge items, projects, tasks
- **System Metrics**: CPU, memory, disk usage

### Grafana Dashboards

Pre-built dashboards for:

- **API Performance**: Response times, error rates, throughput
- **Error Analysis**: Error patterns, severity distribution
- **Business Metrics**: Content creation, project progress
- **Infrastructure**: System resources, service health

### Alerting Rules

Recommended alerts:

- **High Error Rate**: >5% errors in 5 minutes
- **Slow Responses**: >2s average response time
- **System Resources**: >80% CPU or memory usage
- **Service Availability**: Health check failures

## 🔍 Log Analysis

### Correlation ID Tracing

Track a single request across all services:

```bash
# Find all logs for a specific request
grep "550e8400-e29b-41d4-a716-446655440000" /var/log/archon/*.log

# Using structured log analysis
jq 'select(.correlation_id == "550e8400-e29b-41d4-a716-446655440000")' /var/log/archon/app.log
```

### Error Pattern Analysis

```bash
# Find most common error types
jq -r 'select(.level == "ERROR") | .error_type' /var/log/archon/app.log | sort | uniq -c | sort -nr

# Analyze error patterns by endpoint
jq -r 'select(.level == "ERROR") | "\(.request_path) - \(.error_type)"' /var/log/archon/app.log | sort | uniq -c
```

### Performance Analysis

```bash
# Find slowest endpoints
jq -r 'select(.duration_ms != null) | "\(.duration_ms) - \(.request_path)"' /var/log/archon/app.log | sort -nr | head -10

# Average response times by endpoint
jq -r 'select(.duration_ms != null) | "\(.request_path) \(.duration_ms)"' /var/log/archon/app.log | awk '{sum[$1]+=$2; count[$1]++} END {for(i in sum) print i, sum[i]/count[i]}'
```

## 🧪 Testing the Logging System

### Example API Endpoints

Test the logging system using the example endpoints in `logging_example.py`:

```bash
# Test basic logging
curl -X POST http://localhost:8181/api/examples/basic-logging \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item", "category": "example"}'

# Test error handling
curl http://localhost:8181/api/examples/error-handling-demo

# Test performance monitoring
curl http://localhost:8181/api/examples/performance-monitoring

# Test cache operations
curl http://localhost:8181/api/examples/cache-operations

# Test health check with logging
curl http://localhost:8181/api/examples/health-with-logging
```

### Load Testing with Logging

Use the load testing suite to generate logs:

```bash
cd /path/to/archon/python/load_testing
./run_load_tests.sh -s moderate
```

This will generate realistic log patterns for analysis and monitoring setup.

## 🔐 Security Considerations

### Sensitive Data Protection

- **No Passwords in Logs**: Never log passwords, API keys, or tokens
- **PII Sanitization**: User data is hashed or masked in logs
- **Local Variable Capture**: Limited to non-sensitive variables only
- **Header Filtering**: Sensitive headers excluded from logging

### Log Retention

- **Development**: 7 days retention
- **Staging**: 30 days retention  
- **Production**: 90 days retention with archival

### Access Control

- **Log Access**: Restricted to operations team
- **Correlation IDs**: No sensitive data in IDs
- **Error Context**: Sanitized before logging

## 🚀 Production Deployment

### Container Configuration

```dockerfile
# Dockerfile example
ENV LOG_LEVEL=INFO
ENV OTEL_ENABLED=true
ENV ENVIRONMENT=production

# Volume for log persistence
VOLUME ["/app/logs"]
```

### Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: archon-api
spec:
  template:
    spec:
      containers:
      - name: archon-api
        env:
        - name: OTEL_ENABLED
          value: "true"
        - name: JAEGER_ENDPOINT
          value: "http://jaeger-collector:14268/api/traces"
        - name: LOG_LEVEL
          value: "INFO"
```

### Log Aggregation

Recommended stack:

- **Fluent Bit**: Log collection and forwarding
- **Elasticsearch**: Log storage and indexing
- **Kibana**: Log visualization and analysis
- **Grafana**: Metrics and alerting

## 📚 Best Practices

### Logging Guidelines

1. **Use Structured Logging**: Always use the enhanced logger, not Python's built-in logging
2. **Include Context**: Add relevant business context to all log entries
3. **Consistent Naming**: Use consistent field names across services
4. **Appropriate Levels**: DEBUG < INFO < WARNING < ERROR < CRITICAL
5. **Performance Impact**: Logging should not significantly impact performance

### Error Handling

1. **Classify Errors**: Use appropriate error categories and severity
2. **Provide Context**: Include enough information for debugging
3. **Don't Log and Rethrow**: Log at the point where you handle the error
4. **Sensitive Data**: Never include passwords or API keys in error logs

### Tracing Best Practices

1. **Meaningful Span Names**: Use descriptive names for operations
2. **Appropriate Attributes**: Add relevant metadata to spans
3. **Performance Overhead**: Tracing should add <5% overhead
4. **Sampling**: Use sampling in high-traffic production environments

### Monitoring and Alerting

1. **Proactive Monitoring**: Set up alerts before problems occur
2. **Actionable Alerts**: Every alert should have a clear action
3. **Alert Fatigue**: Avoid too many low-priority alerts
4. **Runbook Links**: Include links to troubleshooting guides

## 🔄 Troubleshooting

### Common Issues

#### Logs Not Appearing
```bash
# Check log level
echo $LOG_LEVEL

# Verify logger configuration
python -c "from src.server.logging.structured_logger import get_logger; logger = get_logger('test'); logger.info('test')"
```

#### Correlation IDs Missing
```bash
# Check middleware configuration
curl -H "X-Correlation-ID: test123" http://localhost:8181/health

# Verify in logs
grep "test123" /var/log/archon/app.log
```

#### OpenTelemetry Not Working
```bash
# Check OTEL configuration
echo $OTEL_ENABLED
echo $JAEGER_ENDPOINT

# Test tracer
python -c "from src.server.observability.opentelemetry_config import get_tracer; print(get_tracer())"
```

### Performance Issues

If logging is impacting performance:

1. **Reduce Log Level**: Set LOG_LEVEL=WARNING or ERROR
2. **Disable Local Variable Capture**: Set ERROR_CAPTURE_LOCALS=false
3. **Sampling**: Enable OpenTelemetry sampling
4. **Async Logging**: Consider async log handlers for high-throughput

---

## 🎯 Beta Readiness Status

✅ **Structured Logging**: Production-ready JSON logging with correlation IDs  
✅ **Error Enrichment**: Comprehensive error context and classification  
✅ **Distributed Tracing**: OpenTelemetry integration with multiple exporters  
✅ **Metrics Collection**: Prometheus-compatible metrics export  
✅ **Performance Monitoring**: Request timing and resource usage tracking  
✅ **Security Audit**: Comprehensive security event logging  
✅ **Documentation**: Complete usage guides and examples  

The logging infrastructure is now ready for beta deployment with enterprise-grade observability!