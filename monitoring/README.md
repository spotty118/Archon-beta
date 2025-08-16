# Archon V2 Beta - Production Monitoring Stack

Comprehensive Application Performance Monitoring (APM) system with enterprise-grade observability, alerting, and metrics collection for Archon V2 Beta.

## 🚀 Quick Start

```bash
# Setup and start the complete monitoring stack
cd monitoring/
./setup-monitoring.sh

# Or manually start services
docker-compose -f docker-compose.monitoring.yml up -d
```

## 📊 Monitoring Stack Overview

### Core Components

| Service | Port | Purpose | Dashboard URL |
|---------|------|---------|---------------|
| **Grafana** | 3000 | Visualization & Dashboards | http://localhost:3000 |
| **Prometheus** | 9090 | Metrics Collection | http://localhost:9090 |
| **Alertmanager** | 9093 | Alert Routing & Notifications | http://localhost:9093 |
| **Jaeger** | 16686 | Distributed Tracing | http://localhost:16686 |
| **OpenTelemetry Collector** | 4317/4318 | Telemetry Aggregation | - |
| **Loki** | 3100 | Log Aggregation | - |
| **Node Exporter** | 9100 | System Metrics | http://localhost:9100 |

### Key Features

✅ **Comprehensive Metrics**: API performance, business metrics, system health  
✅ **Distributed Tracing**: OpenTelemetry integration with Jaeger  
✅ **Structured Logging**: JSON logs with correlation IDs  
✅ **Smart Alerting**: Multi-channel notifications (Slack, Email)  
✅ **Pre-built Dashboards**: API performance, business metrics, error analysis  
✅ **Production Ready**: Docker-based deployment with persistent storage  

## 📈 Pre-built Dashboards

### 1. API Performance Dashboard (`archon-api-dashboard.json`)
- **Request Rate**: Requests per second by endpoint
- **Response Times**: P50, P95, P99 percentiles
- **Error Rates**: 4xx/5xx errors by endpoint
- **Active Requests**: Concurrent request monitoring
- **Database Performance**: Query times and connection pool usage
- **Cache Metrics**: Hit rates and operation latency

### 2. Business Metrics Dashboard (`archon-business-dashboard.json`)
- **Knowledge Base**: Total items, growth rate, processing stats
- **Projects & Tasks**: Active projects, task distribution, completion rates
- **Document Processing**: Embedding generation, MCP tool usage
- **External Services**: API response times, success rates

### 3. Error Analysis Dashboard (`archon-error-dashboard.json`)
- **Error Rates**: Overall and by component
- **Service Availability**: SLA compliance tracking
- **Critical Alerts**: Real-time error monitoring
- **Circuit Breakers**: External service health
- **Database Errors**: Connection and query failures

## 🚨 Alerting Rules

### Performance Alerts
- **High Error Rate**: >5% errors for 2 minutes → Critical
- **Slow Response Time**: >3s P95 for 5 minutes → Warning
- **Critical Response Time**: >10s P95 for 1 minute → Critical

### Infrastructure Alerts
- **High Memory Usage**: >85% for 5 minutes → Warning
- **Critical Memory Usage**: >95% for 1 minute → Critical
- **High CPU Usage**: >80% for 10 minutes → Warning

### Business Logic Alerts
- **MCP Tool Failures**: >10% failure rate → Warning
- **Document Processing Failures**: >0.05 errors/sec → Warning
- **Embedding Generation Failures**: >0.1 errors/sec → Warning

### External Service Alerts
- **High Latency**: >30s P95 for external APIs → Warning
- **Circuit Breaker Open**: Immediate → Critical
- **Service Unavailable**: >50% error rate → Critical

## ⚙️ Configuration

### Environment Variables

```bash
# .env file configuration
GRAFANA_ADMIN_PASSWORD=admin123
GRAFANA_DOMAIN=localhost
SMTP_HOST=smtp.gmail.com:587
SMTP_USER=alerts@archon.dev
SMTP_PASSWORD=your_email_password_here
SMTP_FROM=alerts@archon.dev
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
POSTGRES_EXPORTER_URL=postgresql://postgres:password@postgres:5432/archon?sslmode=disable
PROMETHEUS_PORT=8000
```

### Slack Integration

1. Create a Slack app with webhook permissions
2. Add webhook URL to `.env` file
3. Restart Alertmanager: `docker-compose restart alertmanager`

### Email Notifications

1. Configure SMTP settings in `.env`
2. Update `alertmanager.yml` with recipient emails
3. Restart Alertmanager

## 🔧 Management Commands

```bash
# Setup monitoring stack (first time)
./setup-monitoring.sh

# Start services
./setup-monitoring.sh start

# Stop services
./setup-monitoring.sh stop

# View logs
./setup-monitoring.sh logs [service-name]

# Check service status
./setup-monitoring.sh status
```

## 📊 Metrics Collection

### Automatic Metrics

The Archon API automatically exposes metrics on port 8000:

- **HTTP Requests**: Duration, count, status codes
- **Database Queries**: Duration, connection pool usage
- **Cache Operations**: Hit rates, operation times
- **Business Metrics**: Knowledge items, projects, tasks
- **System Health**: CPU, memory, disk usage
- **External APIs**: Response times, error rates

### Custom Metrics

```python
from src.server.monitoring.prometheus_metrics import get_metrics

metrics = get_metrics()

# Record custom business event
metrics.record_request("POST", "/api/knowledge", 200, 0.245, 1024)

# Record database operation
metrics.record_db_query("SELECT", "documents", 0.123, success=True)

# Record cache operation
metrics.record_cache_operation("GET", hit=True, duration=0.005)

# Record error
metrics.record_error("ValidationError", "warning", "api")
```

## 🎯 Production Deployment

### Docker Swarm

```yaml
# docker-stack.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:v2.47.0
    deploy:
      replicas: 1
      placement:
        constraints: [node.role == manager]
    volumes:
      - prometheus_data:/prometheus
    networks:
      - monitoring
```

### Kubernetes

```yaml
# k8s-monitoring.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:v2.47.0
        ports:
        - containerPort: 9090
```

## 🔍 Troubleshooting

### Common Issues

#### Metrics Not Appearing
```bash
# Check if metrics server is running
curl http://localhost:8000/metrics

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# View Prometheus logs
docker-compose logs prometheus
```

#### Alerts Not Firing
```bash
# Check Alertmanager configuration
curl http://localhost:9093/api/v1/status

# View Alertmanager logs
docker-compose logs alertmanager

# Test alert rules
curl http://localhost:9090/api/v1/rules
```

#### Grafana Dashboards Missing
```bash
# Check provisioning
docker-compose exec grafana ls -la /etc/grafana/provisioning/

# Import dashboards manually
# Go to http://localhost:3000/dashboard/import
# Upload JSON files from monitoring/grafana/
```

### Performance Optimization

#### High Memory Usage
```bash
# Reduce Prometheus retention
# Edit prometheus.yml:
storage:
  tsdb:
    retention.time: 7d  # Reduce from 30d
    retention.size: 5GB  # Reduce from 10GB
```

#### Slow Queries
```bash
# Check expensive queries
curl http://localhost:9090/api/v1/query_range?query=topk(10,%20sum%20by%20(__name__)%20({__name__=~%22.%2B%22}))

# Optimize recording rules
# Add to prometheus.yml:
rule_files:
  - "recording_rules.yml"
```

## 📚 Best Practices

### Metrics Design
1. **Use Consistent Labels**: Standardize label names across metrics
2. **Avoid High Cardinality**: Limit unique label combinations
3. **Meaningful Names**: Use descriptive metric and label names
4. **Proper Units**: Include units in metric names (seconds, bytes)

### Alerting Strategy
1. **Alert on Symptoms**: Focus on user-facing issues
2. **Reduce Noise**: Avoid alerts for transient issues
3. **Actionable Alerts**: Every alert should have a clear action
4. **Escalation Paths**: Define severity levels and escalation

### Dashboard Design
1. **User-Centric**: Design for specific audiences (devs, ops, business)
2. **Logical Grouping**: Group related metrics together
3. **Time Ranges**: Use appropriate time ranges for each metric
4. **Drill-Down**: Enable navigation from high-level to detailed views

## 🔗 Integration with Archon

### Application Integration

The monitoring system is automatically integrated with Archon V2:

1. **Startup**: Metrics server starts with the API on port 8000
2. **Middleware**: Request metrics collected automatically
3. **Business Logic**: Manual metrics for domain-specific events
4. **Error Handling**: Automatic error classification and reporting
5. **Shutdown**: Graceful cleanup of monitoring resources

### Development Workflow

1. **Local Development**: Run monitoring stack for debugging
2. **Testing**: Load testing with metrics validation
3. **Staging**: Full monitoring stack for pre-production testing
4. **Production**: Complete observability with alerting

## 📋 Maintenance

### Regular Tasks

#### Daily
- [ ] Check alert status in Slack/Email
- [ ] Review error dashboards for anomalies
- [ ] Verify all services are healthy

#### Weekly
- [ ] Review performance trends
- [ ] Update alert thresholds if needed
- [ ] Check disk usage and retention policies

#### Monthly
- [ ] Analyze capacity planning metrics
- [ ] Review and optimize expensive queries
- [ ] Update monitoring stack images

### Backup and Recovery

```bash
# Backup Grafana dashboards
docker-compose exec grafana grafana-cli admin export-dashboard

# Backup Prometheus data
docker run --rm -v prometheus_data:/data busybox tar czf /backup/prometheus.tar.gz /data

# Backup alerting rules
cp monitoring/alerts/* /backup/alerts/
```

---

## 🎉 Beta Readiness Status

✅ **Comprehensive Metrics**: API, business, and system metrics  
✅ **Production Dashboards**: 3 pre-built dashboards for monitoring  
✅ **Smart Alerting**: Multi-channel notifications with proper routing  
✅ **Distributed Tracing**: OpenTelemetry integration with Jaeger  
✅ **Log Aggregation**: Structured logs with correlation IDs  
✅ **Automated Setup**: One-command deployment script  
✅ **Documentation**: Complete setup and maintenance guides  

**The production monitoring stack is ready for Archon V2 Beta deployment! 🚀**