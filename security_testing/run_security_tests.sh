#!/bin/bash
"""
Archon V2 Beta Security Testing Script

Automated security testing script for Archon V2 Beta deployment validation.
Runs comprehensive OWASP Top 10 2021 security assessment and validates beta readiness.

Usage:
    ./run_security_tests.sh                    # Full security assessment
    ./run_security_tests.sh --quick            # Quick vulnerability scan
    ./run_security_tests.sh --critical-only    # Critical issues check only
    ./run_security_tests.sh --categories sql,xss,csrf  # Specific categories
"""

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHON_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$SCRIPT_DIR/security_test.log"
RESULTS_DIR="$SCRIPT_DIR/results"

# Default configuration
TARGET_URL="${SECURITY_TEST_TARGET:-http://localhost:8181}"
API_URL="${SECURITY_TEST_API:-http://localhost:8181/api}"
FRONTEND_URL="${SECURITY_TEST_FRONTEND:-http://localhost:3737}"
TIMEOUT="${SECURITY_TEST_TIMEOUT:-30}"
CONCURRENCY="${SECURITY_TEST_CONCURRENCY:-5}"
OUTPUT_FORMAT="${SECURITY_TEST_FORMAT:-json}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

print_banner() {
    echo -e "${PURPLE}"
    echo "========================================================================"
    echo "🔒 ARCHON V2 BETA SECURITY TESTING FRAMEWORK"
    echo "========================================================================"
    echo "Target URL: $TARGET_URL"
    echo "API URL: $API_URL"
    echo "Test Categories: ${TEST_CATEGORIES:-All OWASP Top 10 2021}"
    echo "Output Directory: $RESULTS_DIR"
    echo "========================================================================"
    echo -e "${NC}"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is required but not installed"
        exit 1
    fi
    
    # Check pip packages
    if ! python3 -c "import httpx, aiohttp, pydantic" &> /dev/null; then
        log_warning "Some Python dependencies missing. Installing..."
        pip3 install -r "$SCRIPT_DIR/requirements.txt" || {
            log_error "Failed to install Python dependencies"
            exit 1
        }
    fi
    
    log_success "All dependencies available"
}

check_target_availability() {
    log_info "Checking target availability..."
    
    # Check main application
    if ! curl -s --max-time 10 "$TARGET_URL/health" > /dev/null; then
        log_error "Target application not available at $TARGET_URL"
        log_info "Please ensure Archon is running with: docker-compose up -d"
        exit 1
    fi
    
    # Check API endpoints
    if ! curl -s --max-time 10 "$API_URL/health" > /dev/null; then
        log_warning "API endpoint not responding at $API_URL"
    fi
    
    log_success "Target application is available"
}

setup_environment() {
    log_info "Setting up test environment..."
    
    # Create results directory
    mkdir -p "$RESULTS_DIR"
    
    # Create log file
    touch "$LOG_FILE"
    
    # Set environment variables
    export SECURITY_TEST_BASE_URL="$TARGET_URL"
    export SECURITY_TEST_API_URL="$API_URL"
    export SECURITY_TEST_FRONTEND_URL="$FRONTEND_URL"
    export SECURITY_TEST_TIMEOUT="$TIMEOUT"
    export SECURITY_TEST_CONCURRENCY="$CONCURRENCY"
    export SECURITY_TEST_OUTPUT="$RESULTS_DIR"
    
    log_success "Environment configured"
}

run_security_tests() {
    local test_args=("--target" "$TARGET_URL" "--timeout" "$TIMEOUT" "--concurrency" "$CONCURRENCY")
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local output_file="$RESULTS_DIR/security_assessment_$timestamp.json"
    
    log_info "Starting security assessment..."
    
    # Add specific arguments based on mode
    case "${TEST_MODE:-full}" in
        "quick")
            test_args+=("--categories" "sql_injection,xss,csrf,ssrf")
            log_info "Running quick security scan (critical vulnerabilities only)"
            ;;
        "critical")
            test_args+=("--categories" "sql_injection,command_injection,auth_bypass")
            log_info "Running critical security issues check"
            ;;
        "categories")
            test_args+=("--categories" "$TEST_CATEGORIES")
            log_info "Running specific test categories: $TEST_CATEGORIES"
            ;;
        "single")
            test_args+=("--test" "$SINGLE_TEST")
            log_info "Running single test: $SINGLE_TEST"
            ;;
        "deep")
            test_args+=("--deep-scan")
            log_info "Running deep security scan (all tests + additional payloads)"
            ;;
        *)
            log_info "Running comprehensive security assessment (all OWASP Top 10 2021)"
            ;;
    esac
    
    # Add output file
    test_args+=("--output" "$output_file")
    
    # Add verbose flag if requested
    if [[ "${VERBOSE:-false}" == "true" ]]; then
        test_args+=("--verbose")
    fi
    
    # Run the security tests
    log_info "Executing: python3 test_runner.py ${test_args[*]}"
    
    cd "$SCRIPT_DIR"
    
    local exit_code=0
    python3 test_runner.py "${test_args[@]}" || exit_code=$?
    
    # Interpret exit codes
    case $exit_code in
        0)
            log_success "✅ Security assessment PASSED - Ready for beta deployment!"
            log_success "Zero critical vulnerabilities found"
            ;;
        2)
            log_error "❌ Security assessment FAILED - NOT ready for beta deployment"
            log_error "Critical vulnerabilities found that must be addressed"
            ;;
        1)
            log_error "❌ Security test execution failed"
            log_error "Check the logs for technical issues"
            ;;
        130)
            log_warning "Security testing interrupted by user"
            ;;
        *)
            log_error "Unexpected exit code: $exit_code"
            ;;
    esac
    
    # Display results file location
    if [[ -f "$output_file" ]]; then
        log_info "📄 Detailed results saved to: $output_file"
        
        # Extract summary if possible
        if command -v jq &> /dev/null; then
            local critical_count=$(jq -r '.summary.critical_count // 0' "$output_file" 2>/dev/null || echo "unknown")
            local high_count=$(jq -r '.summary.high_count // 0' "$output_file" 2>/dev/null || echo "unknown")
            local total_vulns=$(jq -r '.summary.total_vulnerabilities // 0' "$output_file" 2>/dev/null || echo "unknown")
            
            echo -e "${CYAN}"
            echo "📊 QUICK SUMMARY:"
            echo "  Total Vulnerabilities: $total_vulns"
            echo "  Critical Issues: $critical_count"
            echo "  High Severity Issues: $high_count"
            echo -e "${NC}"
        fi
    fi
    
    return $exit_code
}

generate_report() {
    local latest_result=$(ls -t "$RESULTS_DIR"/security_assessment_*.json | head -1)
    
    if [[ -f "$latest_result" ]]; then
        log_info "Generating security report..."
        
        # Create HTML report if jq is available
        if command -v jq &> /dev/null; then
            local html_report="${latest_result%.json}.html"
            python3 -c "
import json
import sys
from datetime import datetime

try:
    with open('$latest_result', 'r') as f:
        data = json.load(f)
    
    summary = data.get('summary', {})
    vulns = data.get('vulnerabilities', [])
    
    html = '''<!DOCTYPE html>
<html>
<head>
    <title>Archon V2 Security Assessment Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .summary { background: #ecf0f1; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .critical { color: #e74c3c; font-weight: bold; }
        .high { color: #f39c12; font-weight: bold; }
        .medium { color: #f1c40f; font-weight: bold; }
        .low { color: #3498db; font-weight: bold; }
        .passed { color: #27ae60; font-weight: bold; }
        .failed { color: #e74c3c; font-weight: bold; }
        .vuln { border-left: 4px solid #3498db; padding: 10px; margin: 10px 0; background: #f8f9fa; }
        .vuln.critical { border-color: #e74c3c; }
        .vuln.high { border-color: #f39c12; }
    </style>
</head>
<body>
    <div class=\"header\">
        <h1>🔒 Archon V2 Security Assessment Report</h1>
        <p>Generated: ''' + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + '''</p>
    </div>
    
    <div class=\"summary\">
        <h2>📊 Summary</h2>
        <p>Total Vulnerabilities: ''' + str(summary.get('total_vulnerabilities', 0)) + '''</p>
        <p>Critical: <span class=\"critical\">''' + str(summary.get('critical_count', 0)) + '''</span></p>
        <p>High: <span class=\"high\">''' + str(summary.get('high_count', 0)) + '''</span></p>
        <p>Medium: <span class=\"medium\">''' + str(summary.get('medium_count', 0)) + '''</span></p>
        <p>Low: <span class=\"low\">''' + str(summary.get('low_count', 0)) + '''</span></p>
        <p>Beta Ready: <span class=\"''' + ('passed' if summary.get('beta_ready') else 'failed') + '''\">''' + ('Yes' if summary.get('beta_ready') else 'No') + '''</span></p>
    </div>
    
    <div class=\"vulnerabilities\">
        <h2>🚨 Vulnerabilities</h2>'''
    
    for vuln in vulns:
        severity = vuln.get('severity', 'unknown').lower()
        html += f'''
        <div class=\"vuln {severity}\">
            <h3>{vuln.get('title', 'Unknown Vulnerability')}</h3>
            <p><strong>Severity:</strong> {vuln.get('severity', 'Unknown')}</p>
            <p><strong>Category:</strong> {vuln.get('category', 'Unknown')}</p>
            <p><strong>Endpoint:</strong> {vuln.get('endpoint', 'Unknown')}</p>
            <p><strong>Description:</strong> {vuln.get('description', 'No description available')}</p>
            <p><strong>Remediation:</strong> {vuln.get('remediation', 'No remediation guidance available')}</p>
        </div>'''
    
    html += '''
    </div>
</body>
</html>'''
    
    with open('$html_report', 'w') as f:
        f.write(html)
    
    print('HTML report generated: $html_report')
except Exception as e:
    print(f'Error generating HTML report: {e}', file=sys.stderr)
"
        fi
    fi
}

cleanup() {
    log_info "Cleaning up temporary files..."
    # Add any cleanup tasks here
    log_success "Cleanup completed"
}

show_help() {
    cat << EOF
Archon V2 Beta Security Testing Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --quick             Run quick security scan (critical vulnerabilities only)
    --critical-only     Check for critical security issues only
    --deep-scan         Run comprehensive deep scan with additional payloads
    --categories CATS   Run specific test categories (comma-separated)
    --test TEST_NAME    Run a single specific test
    --target URL        Target URL (default: http://localhost:8181)
    --api-url URL       API URL (default: <target>/api)
    --timeout SECONDS   Request timeout (default: 30)
    --concurrency N     Max concurrent tests (default: 5)
    --output-dir DIR    Output directory (default: ./results)
    --verbose           Enable verbose output
    --help              Show this help message

EXAMPLES:
    $0                                    # Full security assessment
    $0 --quick                           # Quick vulnerability scan
    $0 --categories sql_injection,xss   # Specific categories
    $0 --test sql_injection             # Single test
    $0 --deep-scan --verbose            # Deep scan with verbose output
    $0 --target https://staging.app     # Test staging environment

ENVIRONMENT VARIABLES:
    SECURITY_TEST_TARGET     Target URL
    SECURITY_TEST_API        API URL
    SECURITY_TEST_TIMEOUT    Request timeout in seconds
    SECURITY_TEST_CONCURRENCY    Max concurrent tests

EXIT CODES:
    0    Security assessment passed (beta ready)
    1    Test execution error
    2    Security vulnerabilities found (not beta ready)
    130  Interrupted by user

For more information, see the README.md file.
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            TEST_MODE="quick"
            shift
            ;;
        --critical-only)
            TEST_MODE="critical"
            shift
            ;;
        --deep-scan)
            TEST_MODE="deep"
            shift
            ;;
        --categories)
            TEST_MODE="categories"
            TEST_CATEGORIES="$2"
            shift 2
            ;;
        --test)
            TEST_MODE="single"
            SINGLE_TEST="$2"
            shift 2
            ;;
        --target)
            TARGET_URL="$2"
            shift 2
            ;;
        --api-url)
            API_URL="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --concurrency)
            CONCURRENCY="$2"
            shift 2
            ;;
        --output-dir)
            RESULTS_DIR="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE="true"
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Trap for cleanup on exit
trap cleanup EXIT

# Main execution
main() {
    print_banner
    
    check_dependencies
    check_target_availability
    setup_environment
    
    local exit_code=0
    run_security_tests || exit_code=$?
    
    generate_report
    
    # Final status message
    echo ""
    case $exit_code in
        0)
            log_success "🎉 ARCHON V2 BETA SECURITY VALIDATION PASSED!"
            log_success "The application is ready for beta deployment."
            ;;
        2)
            log_error "🚨 ARCHON V2 BETA SECURITY VALIDATION FAILED!"
            log_error "Critical security issues must be resolved before beta deployment."
            ;;
        *)
            log_error "🔧 Security testing encountered technical issues."
            log_error "Please review the logs and try again."
            ;;
    esac
    
    echo ""
    log_info "📋 Results and logs available in: $RESULTS_DIR"
    log_info "📜 Test execution log: $LOG_FILE"
    
    exit $exit_code
}

# Execute main function
main "$@"