#!/usr/bin/env python3
"""
Security Testing Framework Validation

Quick validation script to test the security testing framework components
without requiring a running Archon instance.
"""

import asyncio
import sys
import json
from pathlib import Path

async def validate_imports():
    """Validate that all required modules can be imported."""
    print("🔍 Validating framework imports...")
    
    try:
        from config import SecurityTestConfig, SQL_INJECTION_PAYLOADS, XSS_PAYLOADS
        print("✅ Configuration module imported successfully")
        
        from owasp_security_tests import OwaspSecurityTester
        print("✅ OWASP security tester imported successfully")
        
        from test_runner import SecurityTestRunner
        print("✅ Test runner imported successfully")
        
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False

async def validate_configuration():
    """Validate configuration loading and settings."""
    print("\n⚙️ Validating configuration...")
    
    try:
        from config import SecurityTestConfig, OWASP_TOP_10_MAPPING, SEVERITY_LEVELS
        
        # Test environment configuration
        config = SecurityTestConfig.from_env()
        print(f"✅ Default configuration loaded: {config.base_url}")
        
        # Test configuration override
        custom_config = SecurityTestConfig(
            base_url="http://test.example.com",
            deep_scan=True,
            max_concurrent_tests=10
        )
        print(f"✅ Custom configuration created: {custom_config.base_url}")
        
        # Validate OWASP mapping
        assert len(OWASP_TOP_10_MAPPING) == 10, "OWASP Top 10 mapping incomplete"
        print(f"✅ OWASP Top 10 2021 mapping complete: {len(OWASP_TOP_10_MAPPING)} categories")
        
        # Validate severity levels
        assert 'CRITICAL' in SEVERITY_LEVELS, "Critical severity level missing"
        assert 'HIGH' in SEVERITY_LEVELS, "High severity level missing"
        print(f"✅ Severity levels defined: {list(SEVERITY_LEVELS.keys())}")
        
        return True
    except Exception as e:
        print(f"❌ Configuration validation error: {e}")
        return False

async def validate_test_data():
    """Validate test payloads and data structures."""
    print("\n📊 Validating test data...")
    
    try:
        from config import (
            SQL_INJECTION_PAYLOADS, XSS_PAYLOADS, PATH_TRAVERSAL_PAYLOADS,
            SSRF_TEST_URLS, COMMAND_INJECTION_PAYLOADS, MALICIOUS_FILE_PAYLOADS
        )
        
        # Validate payload counts
        assert len(SQL_INJECTION_PAYLOADS) >= 15, f"Insufficient SQL injection payloads: {len(SQL_INJECTION_PAYLOADS)}"
        assert len(XSS_PAYLOADS) >= 15, f"Insufficient XSS payloads: {len(XSS_PAYLOADS)}"
        assert len(PATH_TRAVERSAL_PAYLOADS) >= 8, f"Insufficient path traversal payloads: {len(PATH_TRAVERSAL_PAYLOADS)}"
        assert len(SSRF_TEST_URLS) >= 8, f"Insufficient SSRF test URLs: {len(SSRF_TEST_URLS)}"
        assert len(COMMAND_INJECTION_PAYLOADS) >= 15, f"Insufficient command injection payloads: {len(COMMAND_INJECTION_PAYLOADS)}"
        assert len(MALICIOUS_FILE_PAYLOADS) >= 8, f"Insufficient malicious file payloads: {len(MALICIOUS_FILE_PAYLOADS)}"
        
        print(f"✅ SQL Injection payloads: {len(SQL_INJECTION_PAYLOADS)}")
        print(f"✅ XSS payloads: {len(XSS_PAYLOADS)}")
        print(f"✅ Path traversal payloads: {len(PATH_TRAVERSAL_PAYLOADS)}")
        print(f"✅ SSRF test URLs: {len(SSRF_TEST_URLS)}")
        print(f"✅ Command injection payloads: {len(COMMAND_INJECTION_PAYLOADS)}")
        print(f"✅ Malicious file payloads: {len(MALICIOUS_FILE_PAYLOADS)}")
        
        return True
    except Exception as e:
        print(f"❌ Test data validation error: {e}")
        return False

async def validate_test_runner():
    """Validate test runner functionality."""
    print("\n🏃 Validating test runner...")
    
    try:
        from test_runner import SecurityTestRunner
        from config import SecurityTestConfig
        
        # Create test configuration
        config = SecurityTestConfig(
            base_url="http://localhost:8181",
            request_timeout=5,
            max_concurrent_tests=2
        )
        
        # Create test runner
        runner = SecurityTestRunner(config)
        print("✅ Test runner created successfully")
        
        # Validate available tests
        available_tests = runner._get_available_tests()
        assert len(available_tests) >= 10, f"Insufficient test categories: {len(available_tests)}"
        print(f"✅ Available test categories: {len(available_tests)}")
        
        # Validate OWASP mapping function
        owasp_cat = runner._map_to_owasp_category('sql_injection')
        assert owasp_cat == 'A03', f"Incorrect OWASP mapping for SQL injection: {owasp_cat}"
        print("✅ OWASP category mapping functional")
        
        return True
    except Exception as e:
        print(f"❌ Test runner validation error: {e}")
        return False

async def validate_file_structure():
    """Validate that all required files are present."""
    print("\n📁 Validating file structure...")
    
    required_files = [
        "config.py",
        "owasp_security_tests.py", 
        "test_runner.py",
        "requirements.txt",
        "README.md",
        "run_security_tests.sh",
        ".env.example"
    ]
    
    script_dir = Path(__file__).parent
    all_present = True
    
    for file_name in required_files:
        file_path = script_dir / file_name
        if file_path.exists():
            print(f"✅ {file_name}")
        else:
            print(f"❌ {file_name} - Missing")
            all_present = False
    
    return all_present

async def validate_security_tester():
    """Validate security tester class without network calls."""
    print("\n🔒 Validating security tester...")
    
    try:
        from owasp_security_tests import OwaspSecurityTester
        from config import SecurityTestConfig
        
        # Create test configuration
        config = SecurityTestConfig(base_url="http://localhost:8181")
        
        # Create security tester
        tester = OwaspSecurityTester(config)
        print("✅ Security tester created successfully")
        
        # Check that all test methods exist
        test_methods = [
            '_test_sql_injection',
            '_test_xss_vulnerabilities', 
            '_test_csrf_protection',
            '_test_ssrf_vulnerabilities',
            '_test_authentication_bypass',
            '_test_authorization_flaws',
            '_test_input_validation',
            '_test_file_upload_security',
            '_test_path_traversal',
            '_test_command_injection',
            '_test_security_headers',
            '_test_session_management'
        ]
        
        for method_name in test_methods:
            if hasattr(tester, method_name):
                print(f"✅ {method_name}")
            else:
                print(f"❌ {method_name} - Missing")
                return False
        
        return True
    except Exception as e:
        print(f"❌ Security tester validation error: {e}")
        return False

async def create_sample_config():
    """Create a sample configuration file for testing."""
    print("\n📝 Creating sample configuration...")
    
    try:
        sample_config = {
            "base_url": "http://localhost:8181",
            "api_base_url": "http://localhost:8181/api",
            "admin_username": "admin",
            "admin_password": "admin123",
            "max_concurrent_tests": 3,
            "request_timeout": 15,
            "deep_scan": False,
            "enable_sql_injection": True,
            "enable_xss_testing": True,
            "enable_csrf_testing": True,
            "output_directory": "test_results",
            "severity_threshold": "medium"
        }
        
        config_path = Path(__file__).parent / "sample_config.json"
        with open(config_path, 'w') as f:
            json.dump(sample_config, f, indent=2)
        
        print(f"✅ Sample configuration created: {config_path}")
        return True
    except Exception as e:
        print(f"❌ Sample configuration creation error: {e}")
        return False

async def main():
    """Main validation function."""
    print("🔒 ARCHON V2 SECURITY TESTING FRAMEWORK VALIDATION")
    print("=" * 60)
    
    validation_results = []
    
    # Run all validation tests
    validation_results.append(await validate_file_structure())
    validation_results.append(await validate_imports())
    validation_results.append(await validate_configuration())
    validation_results.append(await validate_test_data())
    validation_results.append(await validate_test_runner())
    validation_results.append(await validate_security_tester())
    validation_results.append(await create_sample_config())
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 VALIDATION SUMMARY")
    print("=" * 60)
    
    passed_tests = sum(validation_results)
    total_tests = len(validation_results)
    
    if passed_tests == total_tests:
        print(f"✅ ALL VALIDATIONS PASSED ({passed_tests}/{total_tests})")
        print("🎉 Security testing framework is ready for use!")
        print("\nNext steps:")
        print("1. Ensure Archon V2 is running: docker-compose up -d")
        print("2. Run security tests: ./run_security_tests.sh")
        print("3. Review results for beta readiness validation")
        return 0
    else:
        print(f"❌ VALIDATION FAILED ({passed_tests}/{total_tests} passed)")
        print("🔧 Please address the issues above before using the framework")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)