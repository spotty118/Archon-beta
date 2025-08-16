#!/bin/bash

# Archon V2 Beta Load Testing Runner
# Comprehensive load testing automation for beta readiness validation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$SCRIPT_DIR/load_test_results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.load-test.yml"

# Default values
SCENARIO="moderate"
SKIP_BUILD=false
SKIP_CLEANUP=false
MONITOR_ONLY=false
SEED_DATA=true

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -s, --scenario SCENARIO    Load test scenario (light|moderate|heavy|stress|spike|enterprise_baseline|enterprise_peak|enterprise_spike|enterprise_endurance)"
    echo "  --skip-build              Skip Docker image building"
    echo "  --skip-cleanup            Skip cleanup after testing"
    echo "  --monitor-only            Start monitoring stack only (no load testing)"
    echo "  --no-seed                 Skip test data seeding"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -s moderate                    # Run moderate load test"
    echo "  $0 -s enterprise_peak --skip-build  # Run enterprise peak test without rebuilding"
    echo "  $0 --monitor-only                 # Start monitoring stack only"
    echo ""
    echo "Available scenarios:"
    echo "  light                - 10 users, 2 minutes"
    echo "  moderate             - 50 users, 5 minutes"
    echo "  heavy                - 100 users, 10 minutes"
    echo "  stress               - 200 users, 5 minutes"
    echo "  spike                - 500 users, 3 minutes"
    echo "  enterprise_baseline  - 25 users, 10 minutes (enterprise workflow)"
    echo "  enterprise_peak      - 100 users, 15 minutes (enterprise workflow)"
    echo "  enterprise_spike     - 200 users, 5 minutes (enterprise workflow)"
    echo "  enterprise_endurance - 50 users, 1 hour (enterprise workflow)"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--scenario)
            SCENARIO="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        --monitor-only)
            MONITOR_ONLY=true
            shift
            ;;
        --no-seed)
            SEED_DATA=false
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Verify compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create results directory
setup_results_directory() {
    log_info "Setting up results directory..."
    
    mkdir -p "$RESULTS_DIR"
    chmod 755 "$RESULTS_DIR"
    
    log_success "Results directory ready: $RESULTS_DIR"
}

# Build Docker images
build_images() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_warning "Skipping Docker image build"
        return
    fi
    
    log_info "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build main application images
    docker-compose -f "$COMPOSE_FILE" build --parallel
    
    if [[ $? -eq 0 ]]; then
        log_success "Docker images built successfully"
    else
        log_error "Failed to build Docker images"
        exit 1
    fi
}

# Start monitoring stack
start_monitoring() {
    log_info "Starting monitoring stack..."
    
    # Start Prometheus and Grafana
    docker-compose -f "$COMPOSE_FILE" up -d prometheus grafana
    
    # Wait for services to be ready
    log_info "Waiting for monitoring services to be ready..."
    sleep 10
    
    # Check Prometheus
    for i in {1..30}; do
        if curl -s http://localhost:9090/-/ready > /dev/null 2>&1; then
            log_success "Prometheus is ready"
            break
        fi
        
        if [[ $i -eq 30 ]]; then
            log_error "Prometheus failed to start"
            return 1
        fi
        
        sleep 2
    done
    
    # Check Grafana
    for i in {1..30}; do
        if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
            log_success "Grafana is ready"
            break
        fi
        
        if [[ $i -eq 30 ]]; then
            log_error "Grafana failed to start"
            return 1
        fi
        
        sleep 2
    done
    
    log_success "Monitoring stack is ready"
    log_info "📊 Grafana Dashboard: http://localhost:3000 (admin/load_test_admin)"
    log_info "📈 Prometheus: http://localhost:9090"
}

# Start application stack
start_application() {
    log_info "Starting application stack..."
    
    # Start core services
    docker-compose -f "$COMPOSE_FILE" up -d postgres redis
    
    # Wait for database
    log_info "Waiting for database to be ready..."
    for i in {1..60}; do
        if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U archon_user -d archon_load_test > /dev/null 2>&1; then
            log_success "Database is ready"
            break
        fi
        
        if [[ $i -eq 60 ]]; then
            log_error "Database failed to start"
            return 1
        fi
        
        sleep 2
    done
    
    # Start application services
    docker-compose -f "$COMPOSE_FILE" up -d archon-api archon-mcp
    
    # Wait for API to be ready
    log_info "Waiting for API to be ready..."
    for i in {1..60}; do
        if curl -s http://localhost:8181/health > /dev/null 2>&1; then
            log_success "API is ready"
            break
        fi
        
        if [[ $i -eq 60 ]]; then
            log_error "API failed to start"
            return 1
        fi
        
        sleep 2
    done
    
    log_success "Application stack is ready"
}

# Seed test data
seed_test_data() {
    if [[ "$SEED_DATA" == "false" ]]; then
        log_warning "Skipping test data seeding"
        return
    fi
    
    log_info "Seeding test data..."
    
    # Run data seeder
    docker-compose -f "$COMPOSE_FILE" run --rm data-seeder
    
    if [[ $? -eq 0 ]]; then
        log_success "Test data seeded successfully"
    else
        log_error "Failed to seed test data"
        return 1
    fi
}

# Run load test
run_load_test() {
    log_info "Running load test scenario: $SCENARIO"
    
    # Determine if it's an enterprise scenario
    if [[ "$SCENARIO" == enterprise_* ]]; then
        log_info "Running enterprise production scenario"
        
        # Use production scenarios script
        docker-compose -f "$COMPOSE_FILE" run --rm \
            -e SCENARIO="$SCENARIO" \
            -v "$RESULTS_DIR:/app/results" \
            archon-load-test \
            python -m load_testing.production_scenarios "$SCENARIO"
    else
        log_info "Running standard load test scenario"
        
        # Use standard load test suite
        docker-compose -f "$COMPOSE_FILE" run --rm \
            -e SCENARIO="$SCENARIO" \
            -v "$RESULTS_DIR:/app/results" \
            archon-load-test \
            python -m load_testing.load_test_suite \
            --scenario "$SCENARIO" \
            --output "/app/results/load_test_report_${SCENARIO}_${TIMESTAMP}.json"
    fi
    
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Load test completed successfully"
    else
        log_error "Load test failed with exit code: $exit_code"
    fi
    
    return $exit_code
}

# Generate summary report
generate_summary() {
    log_info "Generating test summary..."
    
    local report_file=$(find "$RESULTS_DIR" -name "*${SCENARIO}*${TIMESTAMP}*.json" -type f | head -n1)
    
    if [[ -n "$report_file" && -f "$report_file" ]]; then
        log_success "Load test report: $report_file"
        
        # Extract key metrics using jq if available
        if command -v jq &> /dev/null; then
            echo ""
            echo "=== LOAD TEST SUMMARY ==="
            echo "Scenario: $SCENARIO"
            echo "Timestamp: $TIMESTAMP"
            echo ""
            
            jq -r '
                "Total Requests: " + (.total_requests // 0 | tostring),
                "Successful Requests: " + (.successful_requests // 0 | tostring),
                "Failed Requests: " + (.failed_requests // 0 | tostring),
                "Average Response Time: " + (.avg_response_time // 0 | tostring) + "ms",
                "95th Percentile: " + (.p95_response_time // 0 | tostring) + "ms",
                "Requests/sec: " + (.requests_per_second // 0 | tostring),
                "Error Rate: " + (.error_rate // 0 | . * 100 | tostring) + "%",
                "Peak Memory: " + (.peak_memory_usage_mb // 0 | tostring) + "MB",
                "Peak CPU: " + (.peak_cpu_usage_percent // 0 | tostring) + "%",
                "Result: " + (.pass_fail_status // "UNKNOWN")
            ' "$report_file"
            
            echo "=========================="
        fi
    else
        log_warning "No report file found for summary"
    fi
}

# Cleanup function
cleanup() {
    if [[ "$SKIP_CLEANUP" == "true" ]]; then
        log_warning "Skipping cleanup (services still running)"
        return
    fi
    
    log_info "Cleaning up..."
    
    # Stop all services
    docker-compose -f "$COMPOSE_FILE" down
    
    # Remove test data volumes if not in monitor-only mode
    if [[ "$MONITOR_ONLY" == "false" ]]; then
        docker-compose -f "$COMPOSE_FILE" down -v
    fi
    
    log_success "Cleanup completed"
}

# Trap for cleanup on exit
trap cleanup EXIT

# Main execution
main() {
    echo ""
    echo "🚀 Archon V2 Beta Load Testing Suite"
    echo "===================================="
    echo ""
    
    check_prerequisites
    setup_results_directory
    
    if [[ "$MONITOR_ONLY" == "true" ]]; then
        log_info "Monitor-only mode: Starting monitoring stack"
        start_monitoring
        log_success "Monitoring stack started. Press Ctrl+C to stop."
        
        # Keep running until interrupted
        while true; do
            sleep 10
        done
    else
        build_images
        start_monitoring
        start_application
        seed_test_data
        
        log_info "🎯 Ready to run load test: $SCENARIO"
        echo ""
        
        # Run the load test
        if run_load_test; then
            log_success "✅ Load test completed successfully"
        else
            log_error "❌ Load test failed"
            exit 1
        fi
        
        generate_summary
        
        log_info "📊 Monitor results at: http://localhost:3000"
        log_info "📁 Detailed reports in: $RESULTS_DIR"
    fi
}

# Run main function
main "$@"