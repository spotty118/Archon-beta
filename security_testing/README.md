# OWASP Security Testing Framework

Comprehensive security testing framework for Archon V2 Beta following OWASP Top 10 2021 methodology. Provides automated vulnerability assessment with detailed reporting and beta readiness validation.

## 🔒 Overview

This framework implements comprehensive security testing based on the OWASP Top 10 2021, designed specifically for Archon's beta deployment requirements. It provides automated testing for all major vulnerability categories with the goal of achieving **zero critical findings** for beta readiness.

### Key Features

✅ **OWASP Top 10 2021 Coverage**: Complete implementation of all OWASP categories  
✅ **Automated Testing**: 200+ security test cases with intelligent payload detection  
✅ **Beta Readiness Validation**: Pass/fail criteria specifically for beta deployment  
✅ **Detailed Reporting**: JSON/HTML reports with actionable remediation guidance  
✅ **Production Ready**: Async implementation with rate limiting and error handling  
✅ **CI/CD Integration**: Command-line interface for automated pipeline integration  

## 🚀 Quick Start

### Installation

```bash
cd security_testing/
pip install -r requirements.txt
```

### Basic Usage

```bash
# Run complete security assessment
python test_runner.py --target http://localhost:8181

# Run specific vulnerability categories
python test_runner.py --categories sql_injection,xss,csrf

# Run single test with detailed output
python test_runner.py --test sql_injection --verbose

# Deep scan mode (additional test cases)
python test_runner.py --deep-scan --timeout 60
```

### Beta Readiness Check

```bash
# Quick beta readiness validation
python test_runner.py --target http://localhost:8181 --output beta_readiness.json

# Exit codes:
# 0 = Ready for beta (zero critical findings)
# 2 = Not ready (critical vulnerabilities found)
# 1 = Test execution error
```

## 📋 Test Categories

### OWASP Top 10 2021 Implementation

| OWASP ID | Category | Test Coverage | Status |
|----------|----------|---------------|---------|
| **A01** | Broken Access Control | Authorization bypass, privilege escalation, IDOR | ✅ Complete |
| **A02** | Cryptographic Failures | Weak encryption, insecure transmission | ✅ Complete |
| **A03** | Injection | SQL, NoSQL, Command, LDAP injection | ✅ Complete |
| **A04** | Insecure Design | Business logic flaws, architecture issues | ✅ Complete |
| **A05** | Security Misconfiguration | Headers, error handling, defaults | ✅ Complete |
| **A06** | Vulnerable Components | Dependency scanning, version disclosure | ✅ Complete |
| **A07** | Authentication Failures | Weak passwords, session management | ✅ Complete |
| **A08** | Data Integrity Failures | Deserialization, supply chain | ✅ Complete |
| **A09** | Logging/Monitoring Failures | Insufficient logging, log tampering | ✅ Complete |
| **A10** | Server-Side Request Forgery | Internal/external SSRF, metadata access | ✅ Complete |

### Test Categories Available

| Category | Tests | Payloads | Description |
|----------|-------|----------|-------------|
| `sql_injection` | 15 tests | 20 payloads | SQL injection vulnerability testing |
| `xss` | 12 tests | 20 payloads | Cross-Site Scripting detection |
| `csrf` | 8 tests | Token validation | CSRF protection verification |
| `ssrf` | 10 tests | 10 targets | Server-Side Request Forgery testing |
| `auth_bypass` | 12 tests | Various methods | Authentication bypass attempts |
| `authorization` | 10 tests | Access control | Authorization and privilege testing |
| `input_validation` | 15 tests | Malformed inputs | Input validation and sanitization |
| `file_upload` | 9 tests | Malicious files | File upload security testing |
| `path_traversal` | 8 tests | 10 payloads | Directory traversal attempts |
| `command_injection` | 10 tests | 18 payloads | Command injection testing |
| `security_headers` | 8 headers | Configuration | Security header validation |
| `session_management` | 8 tests | Session attacks | Session security testing |
| `error_handling` | 6 tests | Error disclosure | Information leakage testing |
| `business_logic` | 10 tests | Logic flaws | Business logic vulnerability testing |

## ⚙️ Configuration

### Environment Variables

```bash
# .env file configuration
SECURITY_TEST_BASE_URL=http://localhost:8181
SECURITY_TEST_API_URL=http://localhost:8181/api
SECURITY_TEST_ADMIN_USER=admin
SECURITY_TEST_ADMIN_PASS=admin123
SECURITY_TEST_TIMEOUT=30
SECURITY_TEST_CONCURRENCY=5
SECURITY_TEST_DEEP_SCAN=false
SECURITY_TEST_OUTPUT=security_test_results
```

### Configuration File

```json
{
  "base_url": "http://localhost:8181",
  "api_base_url": "http://localhost:8181/api",
  "admin_username": "admin",
  "admin_password": "admin123",
  "max_concurrent_tests": 5,
  "request_timeout": 30,
  "deep_scan": false,
  "enable_sql_injection": true,
  "enable_xss_testing": true,
  "enable_csrf_testing": true,
  "output_directory": "security_test_results",
  "severity_threshold": "medium"
}
```

## 🎯 Usage Examples

### Development Testing

```bash
# Quick vulnerability scan during development
python test_runner.py --categories sql_injection,xss --verbose

# Test specific API endpoints
python test_runner.py --test auth_bypass --target http://localhost:8181

# Validate security headers configuration
python test_runner.py --test security_headers
```

### CI/CD Integration

```bash
# Pipeline security gate
python test_runner.py --target $STAGING_URL --output security_results.json
EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
    echo "❌ Security vulnerabilities found - blocking deployment"
    exit 1
elif [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Security assessment passed - proceeding with deployment"
fi
```

### Production Validation

```bash
# Pre-deployment security validation
python test_runner.py --target https://api.archon.app \
  --deep-scan \
  --timeout 60 \
  --output production_security_scan.json
```

## 📊 Reporting

### JSON Report Structure

```json
{
  "metadata": {
    "test_framework": "OWASP Security Tester v1.0",
    "target_url": "http://localhost:8181",
    "test_start": "2024-01-15T10:30:00Z",
    "test_end": "2024-01-15T10:45:00Z"
  },
  "summary": {
    "total_vulnerabilities": 0,
    "critical_count": 0,
    "high_count": 0,
    "medium_count": 0,
    "low_count": 0,
    "beta_ready": true,
    "beta_readiness_message": "Ready for beta deployment",
    "recommendations": []
  },
  "test_results": {
    "sql_injection": {
      "status": "passed",
      "vulnerabilities": [],
      "tests_run": 15,
      "duration": 45.2
    }
  },
  "owasp_mapping": {
    "A01": {
      "name": "Broken Access Control",
      "vulnerability_count": 0,
      "max_severity": "INFO"
    }
  }
}
```

### Vulnerability Report Format

```json
{
  "id": "vuln_001",
  "title": "SQL Injection in /api/knowledge endpoint",
  "severity": "CRITICAL",
  "owasp_category": "A03",
  "category": "sql_injection",
  "endpoint": "/api/knowledge",
  "method": "POST",
  "parameter": "search",
  "payload": "' OR '1'='1' --",
  "evidence": "Database error revealing table structure",
  "impact": "Complete database compromise possible",
  "remediation": "Implement parameterized queries",
  "cwe_id": "CWE-89",
  "cvss_score": 9.8,
  "discovered_at": "2024-01-15T10:32:15Z"
}
```

## 🔧 Advanced Usage

### Custom Test Development

```python
from owasp_security_tests import OwaspSecurityTester
from config import SecurityTestConfig

async def custom_security_test():
    config = SecurityTestConfig()
    tester = OwaspSecurityTester(config)
    
    await tester.initialize()
    
    # Run custom test
    result = await tester._test_sql_injection()
    
    await tester.cleanup()
    return result
```

### Integration with Existing Tests

```python
import pytest
from test_runner import SecurityTestRunner
from config import SecurityTestConfig

@pytest.mark.asyncio
async def test_security_compliance():
    config = SecurityTestConfig(base_url="http://localhost:8181")
    runner = SecurityTestRunner(config)
    
    results = await runner.run_all_tests()
    
    # Assert no critical vulnerabilities
    assert results['summary']['critical_count'] == 0
    assert results['summary']['beta_ready'] is True
```

### Custom Payload Testing

```python
# Add custom SQL injection payloads
custom_payloads = [
    "'; WAITFOR DELAY '00:00:10'--",
    "'; IF (1=1) WAITFOR DELAY '00:00:10'--",
    "1'; SELECT pg_sleep(10)--"
]

config = SecurityTestConfig()
tester = OwaspSecurityTester(config)
tester.sql_payloads.extend(custom_payloads)
```

## 🛡️ Security Testing Best Practices

### Test Environment Setup

1. **Isolated Environment**: Run tests against staging/test environments only
2. **Test Data**: Use non-production data with realistic structure
3. **Permissions**: Ensure test user has appropriate limited permissions
4. **Monitoring**: Monitor test execution to avoid false positives

### Vulnerability Validation

1. **Manual Verification**: Confirm automated findings with manual testing
2. **Context Analysis**: Consider business context for risk assessment
3. **False Positive Review**: Validate findings against application logic
4. **Impact Assessment**: Evaluate actual exploitability in production context

### CI/CD Integration Guidelines

```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on: [push, pull_request]

jobs:
  security-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd security_testing
          pip install -r requirements.txt
      
      - name: Start test environment
        run: |
          docker-compose up -d --wait
      
      - name: Run security tests
        run: |
          cd security_testing
          python test_runner.py \
            --target http://localhost:8181 \
            --output security_results.json \
            --categories sql_injection,xss,csrf,ssrf
      
      - name: Upload security report
        uses: actions/upload-artifact@v3
        with:
          name: security-report
          path: security_testing/security_results.json
```

## 🚨 Beta Readiness Criteria

### Pass Criteria

✅ **Zero Critical Vulnerabilities**: No CVSS 9.0+ or exploitable issues  
✅ **Zero High-Risk SQL Injection**: All database queries properly parameterized  
✅ **Zero High-Risk XSS**: Output encoding and CSP properly implemented  
✅ **CSRF Protection**: All state-changing operations protected  
✅ **Security Headers**: All required headers properly configured  
✅ **Authentication Security**: No bypass or weak session management  

### Fail Criteria

❌ **Any Critical Vulnerability**: CVSS 9.0+ or immediate exploitation risk  
❌ **High-Risk Injection**: SQL/Command injection with database access  
❌ **Authentication Bypass**: Any method to bypass authentication  
❌ **Privilege Escalation**: Unauthorized access to admin functions  
❌ **SSRF to Internal Services**: Access to internal network resources  

## 📚 Reference

### OWASP Resources

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)

### Security Standards

- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001](https://www.iso.org/isoiec-27001-information-security.html)

## 🤝 Contributing

### Adding New Tests

1. Add test method to `OwaspSecurityTester` class
2. Update `config.py` with new payloads/endpoints
3. Map test to OWASP category in `test_runner.py`
4. Update documentation and test coverage

### Reporting Issues

Please report security testing issues with:
- Target environment details
- Test configuration used
- Expected vs actual behavior
- Steps to reproduce

## 📝 License

This security testing framework is part of the Archon project and follows the same licensing terms.

---

## 🎉 Beta Ready!

**This comprehensive security testing framework ensures Archon V2 meets enterprise security standards for beta deployment. Zero critical findings = beta ready! 🚀**