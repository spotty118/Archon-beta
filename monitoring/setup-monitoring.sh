#!/bin/bash

# Archon V2 Beta - Production Monitoring Stack Setup
# This script sets up comprehensive APM with Prometheus, Grafana, Jaeger, and Alertmanager

set -e

echo "🚀 Setting up Archon V2 Beta Production Monitoring Stack..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MONITORING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${MONITORING_DIR}/../.env"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    print_status "Checking Docker..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if docker-compose is available
check_docker_compose() {
    print_status "Checking Docker Compose..."
    if ! command -v docker-compose > /dev/null 2>&1; then
        print_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Create necessary directories
create_directories() {
    print_status "Creating monitoring directories..."
    
    mkdir -p "${MONITORING_DIR}/grafana/provisioning/dashboards"
    mkdir -p "${MONITORING_DIR}/grafana/provisioning/datasources"
    mkdir -p "${MONITORING_DIR}/alerts/templates"
    mkdir -p "${MONITORING_DIR}/loki"
    mkdir -p "${MONITORING_DIR}/promtail"
    
    print_success "Directories created"
}

# Create Grafana provisioning files
setup_grafana_provisioning() {
    print_status "Setting up Grafana provisioning..."
    
    # Datasources provisioning
    cat > "${MONITORING_DIR}/grafana/provisioning/datasources/prometheus.yml" << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    
  - name: Jaeger
    type: jaeger
    access: proxy
    url: http://jaeger:16686
    editable: true
    
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
EOF

    # Dashboards provisioning
    cat > "${MONITORING_DIR}/grafana/provisioning/dashboards/archon.yml" << EOF
apiVersion: 1

providers:
  - name: 'archon-dashboards'
    orgId: 1
    folder: 'Archon V2 Beta'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF

    print_success "Grafana provisioning configured"
}

# Create Loki configuration
setup_loki_config() {
    print_status "Setting up Loki configuration..."
    
    cat > "${MONITORING_DIR}/loki/loki-config.yml" << EOF
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /tmp/loki
  storage:
    filesystem:
      chunks_directory: /tmp/loki/chunks
      rules_directory: /tmp/loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://alertmanager:9093

analytics:
  reporting_enabled: false
EOF

    print_success "Loki configuration created"
}

# Create Promtail configuration
setup_promtail_config() {
    print_status "Setting up Promtail configuration..."
    
    cat > "${MONITORING_DIR}/promtail/promtail-config.yml" << EOF
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: containers
    static_configs:
      - targets:
          - localhost
        labels:
          job: containerlogs
          __path__: /var/lib/docker/containers/*/*log

    pipeline_stages:
      - json:
          expressions:
            output: log
            stream: stream
            attrs:
      - json:
          expressions:
            tag:
          source: attrs
      - regex:
          expression: (?P<container_name>(?:[^|]*))?
          source: tag
      - timestamp:
          format: RFC3339Nano
          source: time
      - labels:
          stream:
          container_name:
      - output:
          source: output

  - job_name: syslog
    static_configs:
      - targets:
          - localhost
        labels:
          job: syslog
          __path__: /var/log/syslog
EOF

    print_success "Promtail configuration created"
}

# Setup environment variables
setup_environment() {
    print_status "Setting up environment variables..."
    
    if [ ! -f "$ENV_FILE" ]; then
        print_warning ".env file not found, creating template..."
        cat > "$ENV_FILE" << EOF
# Monitoring Configuration
GRAFANA_ADMIN_PASSWORD=admin123
GRAFANA_DOMAIN=localhost
SMTP_HOST=smtp.gmail.com:587
SMTP_USER=alerts@archon.dev
SMTP_PASSWORD=your_email_password_here
SMTP_FROM=alerts@archon.dev
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
POSTGRES_EXPORTER_URL=postgresql://postgres:password@postgres:5432/archon?sslmode=disable

# Prometheus metrics port (from our Archon API)
PROMETHEUS_PORT=8000
EOF
        print_warning "Please update the .env file with your actual configuration values"
    else
        print_success "Using existing .env file"
    fi
}

# Start monitoring stack
start_monitoring_stack() {
    print_status "Starting monitoring stack..."
    
    cd "$MONITORING_DIR"
    docker-compose -f docker-compose.monitoring.yml up -d
    
    print_success "Monitoring stack started"
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    services=("prometheus:9090" "grafana:3000" "alertmanager:9093" "jaeger:16686")
    
    for service in "${services[@]}"; do
        IFS=':' read -r host port <<< "$service"
        print_status "Waiting for $host:$port..."
        
        for i in {1..30}; do
            if docker-compose -f docker-compose.monitoring.yml exec -T "$host" sh -c "wget -q --spider http://localhost:$port" 2>/dev/null; then
                print_success "$host:$port is ready"
                break
            fi
            
            if [ $i -eq 30 ]; then
                print_warning "$host:$port is not responding after 30 attempts"
            fi
            
            sleep 2
        done
    done
}

# Display service URLs
display_urls() {
    print_success "Monitoring stack is ready!"
    echo ""
    echo "📊 Service URLs:"
    echo "  Grafana Dashboard:    http://localhost:3000 (admin/admin123)"
    echo "  Prometheus:           http://localhost:9090"
    echo "  Alertmanager:         http://localhost:9093"
    echo "  Jaeger Tracing:       http://localhost:16686"
    echo "  Node Exporter:        http://localhost:9100"
    echo ""
    echo "📋 Pre-configured Dashboards:"
    echo "  - Archon API Performance Dashboard"
    echo "  - Archon Business Metrics Dashboard"
    echo "  - Archon Error Analysis Dashboard"
    echo ""
    echo "🚨 Alerting:"
    echo "  - Configured for Slack and Email notifications"
    echo "  - Update alertmanager.yml with your webhook URLs"
    echo ""
    echo "🔧 Next Steps:"
    echo "  1. Update .env file with your notification settings"
    echo "  2. Import Grafana dashboards from monitoring/grafana/"
    echo "  3. Configure Slack/Email notifications in Alertmanager"
    echo "  4. Start your Archon API with PROMETHEUS_PORT=8000"
    echo ""
}

# Main execution
main() {
    echo "=================================================="
    echo "🚀 Archon V2 Beta - Production Monitoring Setup"
    echo "=================================================="
    echo ""
    
    check_docker
    check_docker_compose
    create_directories
    setup_grafana_provisioning
    setup_loki_config
    setup_promtail_config
    setup_environment
    start_monitoring_stack
    wait_for_services
    display_urls
    
    print_success "Monitoring stack setup complete! 🎉"
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "start")
        print_status "Starting monitoring stack..."
        cd "$MONITORING_DIR"
        docker-compose -f docker-compose.monitoring.yml up -d
        display_urls
        ;;
    "stop")
        print_status "Stopping monitoring stack..."
        cd "$MONITORING_DIR"
        docker-compose -f docker-compose.monitoring.yml down
        print_success "Monitoring stack stopped"
        ;;
    "logs")
        cd "$MONITORING_DIR"
        docker-compose -f docker-compose.monitoring.yml logs -f "${2:-}"
        ;;
    "status")
        cd "$MONITORING_DIR"
        docker-compose -f docker-compose.monitoring.yml ps
        ;;
    *)
        echo "Usage: $0 {setup|start|stop|logs|status}"
        echo ""
        echo "Commands:"
        echo "  setup   - Initial setup of monitoring stack"
        echo "  start   - Start monitoring services"
        echo "  stop    - Stop monitoring services"
        echo "  logs    - View logs (optional service name)"
        echo "  status  - Show service status"
        exit 1
        ;;
esac