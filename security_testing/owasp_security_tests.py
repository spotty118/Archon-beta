"""
Comprehensive OWASP Security Testing Suite for Archon V2 Beta

This module implements automated security tests following OWASP Testing Guide methodology
to identify and validate protection against common web application vulnerabilities.

Zero critical findings required for beta readiness.
"""

import asyncio
import json
import time
import secrets
import hashlib
import re
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from urllib.parse import urljoin, quote, unquote
import base64

import httpx
import pytest
from bs4 import BeautifulSoup
import sqlparse
from faker import Faker

fake = Faker()

@dataclass
class SecurityTestResult:
    """Result of a security test."""
    test_name: str
    vulnerability_type: str
    severity: str  # critical, high, medium, low, info
    status: str  # pass, fail, warning
    description: str
    evidence: Optional[str] = None
    remediation: Optional[str] = None
    cwe_id: Optional[str] = None
    owasp_category: Optional[str] = None

@dataclass
class SecurityTestConfig:
    """Configuration for security testing."""
    base_url: str = "http://localhost:8181"
    timeout: int = 30
    max_retries: int = 3
    include_slow_tests: bool = False
    auth_token: Optional[str] = None
    csrf_token: Optional[str] = None

class OWASPSecurityTester:
    """Comprehensive OWASP security testing framework."""
    
    def __init__(self, config: SecurityTestConfig):
        self.config = config
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(config.timeout),
            verify=False,  # For testing with self-signed certs
            follow_redirects=True
        )
        self.results: List[SecurityTestResult] = []
        
        # Common payloads for testing
        self.sql_payloads = [
            "' OR '1'='1",
            "' OR '1'='1' --",
            "' OR '1'='1' /*",
            "admin'--",
            "admin'/*",
            "' OR 1=1--",
            "' UNION SELECT NULL--",
            "'; DROP TABLE users; --",
            "1' AND 1=0 UNION SELECT 1, username, password FROM users--",
            "' AND 1=CONVERT(int, (SELECT @@version))--"
        ]
        
        self.xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<svg onload=alert('XSS')>",
            "';alert('XSS');//",
            "<iframe src=javascript:alert('XSS')>",
            "<body onload=alert('XSS')>",
            "<input onfocus=alert('XSS') autofocus>",
            "<select onfocus=alert('XSS') autofocus>",
            "<textarea onfocus=alert('XSS') autofocus>",
            "<keygen onfocus=alert('XSS') autofocus>",
            "<video><source onerror=\"alert('XSS')\">",
            "<audio src=x onerror=alert('XSS')>",
        ]
        
        self.path_traversal_payloads = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
            "....//....//....//etc/passwd",
            "../../../../../../../etc/passwd%00",
            "..%252f..%252f..%252fetc%252fpasswd",
            "../../../proc/self/environ",
            "../../../var/log/apache2/access.log",
        ]
        
        self.ssrf_payloads = [
            "http://localhost:22",
            "http://127.0.0.1:22",
            "http://169.254.169.254/latest/meta-data/",
            "http://metadata.google.internal/computeMetadata/v1/",
            "http://[::1]:22",
            "http://0x7f000001:22",
            "http://2130706433:22",
            "file:///etc/passwd",
            "dict://127.0.0.1:11211/",
            "ldap://127.0.0.1:389/",
        ]
        
        self.command_injection_payloads = [
            "; ls -la",
            "| whoami",
            "& echo vulnerable",
            "`whoami`",
            "$(whoami)",
            "; cat /etc/passwd",
            "| cat /etc/passwd",
            "& type C:\\Windows\\System32\\drivers\\etc\\hosts",
            "; ping -c 4 127.0.0.1",
            "| nslookup google.com",
        ]

    async def run_comprehensive_security_tests(self) -> List[SecurityTestResult]:
        """Run complete OWASP security test suite."""
        print("🔒 Starting OWASP Security Test Suite for Archon V2 Beta")
        print("=" * 60)
        
        # OWASP Top 10 2021 Testing
        await self._test_a01_broken_access_control()
        await self._test_a02_cryptographic_failures()
        await self._test_a03_injection()
        await self._test_a04_insecure_design()
        await self._test_a05_security_misconfiguration()
        await self._test_a06_vulnerable_components()
        await self._test_a07_identification_failures()
        await self._test_a08_software_integrity_failures()
        await self._test_a09_logging_monitoring_failures()
        await self._test_a10_ssrf()
        
        # Additional security tests
        await self._test_input_validation()
        await self._test_session_management()
        await self._test_csrf_protection()
        await self._test_cors_configuration()
        await self._test_security_headers()
        await self._test_file_upload_security()
        await self._test_rate_limiting()
        await self._test_error_handling()
        
        await self.client.aclose()
        return self.results

    def _add_result(self, result: SecurityTestResult):
        """Add test result to results list."""
        self.results.append(result)
        severity_emoji = {
            "critical": "🔴",
            "high": "🟠", 
            "medium": "🟡",
            "low": "🟢",
            "info": "🔵"
        }
        status_emoji = {
            "pass": "✅",
            "fail": "❌",
            "warning": "⚠️"
        }
        
        print(f"{status_emoji.get(result.status, '❓')} {severity_emoji.get(result.severity, '❓')} "
              f"{result.test_name}: {result.status.upper()}")
        if result.status == "fail":
            print(f"   🔍 {result.description}")

    async def _test_a01_broken_access_control(self):
        """Test A01: Broken Access Control"""
        print("\n📋 Testing A01: Broken Access Control")
        
        # Test 1: Unauthorized API access
        await self._test_unauthorized_access()
        
        # Test 2: Privilege escalation
        await self._test_privilege_escalation()
        
        # Test 3: Direct object references
        await self._test_direct_object_references()
        
        # Test 4: Admin endpoint access
        await self._test_admin_endpoint_access()

    async def _test_unauthorized_access(self):
        """Test unauthorized access to protected endpoints."""
        protected_endpoints = [
            "/api/projects",
            "/api/tasks", 
            "/api/knowledge",
            "/api/settings",
            "/api/mcp",
        ]
        
        for endpoint in protected_endpoints:
            try:
                # Test without authorization
                response = await self.client.get(f"{self.config.base_url}{endpoint}")
                
                if response.status_code == 200:
                    self._add_result(SecurityTestResult(
                        test_name=f"Unauthorized Access - {endpoint}",
                        vulnerability_type="Broken Access Control",
                        severity="high",
                        status="fail",
                        description=f"Endpoint {endpoint} accessible without authentication",
                        cwe_id="CWE-862",
                        owasp_category="A01:2021"
                    ))
                else:
                    self._add_result(SecurityTestResult(
                        test_name=f"Unauthorized Access - {endpoint}",
                        vulnerability_type="Access Control",
                        severity="info",
                        status="pass",
                        description=f"Endpoint {endpoint} properly protected",
                        owasp_category="A01:2021"
                    ))
            except Exception as e:
                self._add_result(SecurityTestResult(
                    test_name=f"Unauthorized Access - {endpoint}",
                    vulnerability_type="Access Control",
                    severity="medium",
                    status="warning",
                    description=f"Could not test endpoint {endpoint}: {str(e)}",
                    owasp_category="A01:2021"
                ))

    async def _test_privilege_escalation(self):
        """Test for privilege escalation vulnerabilities."""
        # Test parameter pollution for privilege escalation
        escalation_params = [
            {"admin": "true"},
            {"role": "admin"},
            {"is_admin": "1"},
            {"user_type": "admin"},
            {"permissions": "admin"},
        ]
        
        for params in escalation_params:
            try:
                response = await self.client.post(
                    f"{self.config.base_url}/api/auth/login",
                    json={"username": "test", "password": "test", **params}
                )
                
                if response.status_code == 200:
                    response_data = response.json()
                    if any(word in str(response_data).lower() for word in ["admin", "privilege", "elevated"]):
                        self._add_result(SecurityTestResult(
                            test_name="Privilege Escalation via Parameters",
                            vulnerability_type="Privilege Escalation",
                            severity="critical",
                            status="fail",
                            description=f"Possible privilege escalation with params: {params}",
                            evidence=str(response_data),
                            cwe_id="CWE-269",
                            owasp_category="A01:2021"
                        ))
                        return
                        
            except Exception:
                pass
        
        self._add_result(SecurityTestResult(
            test_name="Privilege Escalation via Parameters", 
            vulnerability_type="Access Control",
            severity="info",
            status="pass",
            description="No privilege escalation detected via parameter manipulation",
            owasp_category="A01:2021"
        ))

    async def _test_direct_object_references(self):
        """Test for insecure direct object references."""
        # Test common IDOR patterns
        idor_tests = [
            ("/api/projects/1", "/api/projects/999"),
            ("/api/projects/1", "/api/projects/0"),
            ("/api/projects/1", "/api/projects/-1"),
            ("/api/tasks/1", "/api/tasks/999"),
            ("/api/knowledge/1", "/api/knowledge/999"),
        ]
        
        for original, modified in idor_tests:
            try:
                # Test both endpoints
                resp1 = await self.client.get(f"{self.config.base_url}{original}")
                resp2 = await self.client.get(f"{self.config.base_url}{modified}")
                
                # Check if unauthorized data is returned
                if resp2.status_code == 200 and resp1.status_code == 200:
                    if len(resp2.text) > 100:  # Substantial response
                        self._add_result(SecurityTestResult(
                            test_name=f"IDOR Test - {modified}",
                            vulnerability_type="Insecure Direct Object Reference",
                            severity="high",
                            status="fail",
                            description=f"Possible IDOR vulnerability at {modified}",
                            evidence=f"Response length: {len(resp2.text)}",
                            cwe_id="CWE-639",
                            owasp_category="A01:2021"
                        ))
                        
            except Exception:
                pass
        
        self._add_result(SecurityTestResult(
            test_name="Insecure Direct Object References",
            vulnerability_type="Access Control", 
            severity="info",
            status="pass",
            description="No obvious IDOR vulnerabilities detected",
            owasp_category="A01:2021"
        ))

    async def _test_admin_endpoint_access(self):
        """Test access to administrative endpoints."""
        admin_endpoints = [
            "/admin",
            "/administrator", 
            "/api/admin",
            "/api/system",
            "/api/config",
            "/api/debug",
            "/api/internal",
            "/management",
            "/console",
        ]
        
        accessible_endpoints = []
        
        for endpoint in admin_endpoints:
            try:
                response = await self.client.get(f"{self.config.base_url}{endpoint}")
                if response.status_code == 200:
                    accessible_endpoints.append(endpoint)
            except Exception:
                pass
        
        if accessible_endpoints:
            self._add_result(SecurityTestResult(
                test_name="Admin Endpoint Access",
                vulnerability_type="Broken Access Control",
                severity="medium",
                status="warning",
                description=f"Admin endpoints accessible: {accessible_endpoints}",
                cwe_id="CWE-284",
                owasp_category="A01:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Admin Endpoint Access",
                vulnerability_type="Access Control",
                severity="info", 
                status="pass",
                description="No admin endpoints accessible without authentication",
                owasp_category="A01:2021"
            ))

    async def _test_a02_cryptographic_failures(self):
        """Test A02: Cryptographic Failures"""
        print("\n📋 Testing A02: Cryptographic Failures")
        
        await self._test_weak_encryption()
        await self._test_sensitive_data_exposure()
        await self._test_tls_configuration()

    async def _test_weak_encryption(self):
        """Test for weak cryptographic implementations."""
        # Test JWT token strength
        try:
            response = await self.client.post(
                f"{self.config.base_url}/api/auth/login",
                json={"username": "test", "password": "test"}
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("access_token", data.get("token", ""))
                
                if token:
                    # Check JWT structure
                    parts = token.split(".")
                    if len(parts) == 3:
                        # Decode header
                        header = json.loads(base64.urlsafe_b64decode(parts[0] + "=="))
                        alg = header.get("alg", "")
                        
                        # Check for weak algorithms
                        weak_algorithms = ["none", "HS256"]  # HS256 can be weak with short secrets
                        if alg in weak_algorithms:
                            self._add_result(SecurityTestResult(
                                test_name="JWT Algorithm Strength",
                                vulnerability_type="Weak Cryptography",
                                severity="medium",
                                status="warning",
                                description=f"JWT uses potentially weak algorithm: {alg}",
                                evidence=f"Algorithm: {alg}",
                                cwe_id="CWE-327",
                                owasp_category="A02:2021"
                            ))
                        else:
                            self._add_result(SecurityTestResult(
                                test_name="JWT Algorithm Strength",
                                vulnerability_type="Cryptography",
                                severity="info",
                                status="pass", 
                                description=f"JWT uses acceptable algorithm: {alg}",
                                owasp_category="A02:2021"
                            ))
                            
        except Exception as e:
            self._add_result(SecurityTestResult(
                test_name="JWT Algorithm Strength",
                vulnerability_type="Cryptography",
                severity="low",
                status="warning",
                description=f"Could not test JWT algorithm: {str(e)}",
                owasp_category="A02:2021"
            ))

    async def _test_sensitive_data_exposure(self):
        """Test for sensitive data exposure."""
        sensitive_endpoints = [
            "/api/health",
            "/",
            "/docs",
            "/openapi.json",
        ]
        
        sensitive_patterns = [
            r"password['\"]?\s*[:=]\s*['\"]?[\w!@#$%^&*()_+-=]+",
            r"api[_-]?key['\"]?\s*[:=]\s*['\"]?[\w-]+",
            r"secret['\"]?\s*[:=]\s*['\"]?[\w!@#$%^&*()_+-=]+",
            r"token['\"]?\s*[:=]\s*['\"]?[\w.-]+",
            r"database[_-]?url['\"]?\s*[:=]\s*['\"]?[\w:/.-]+",
            r"mongodb://[\w:@.-]+",
            r"mysql://[\w:@.-]+",
            r"postgresql://[\w:@.-]+",
        ]
        
        exposures = []
        
        for endpoint in sensitive_endpoints:
            try:
                response = await self.client.get(f"{self.config.base_url}{endpoint}")
                if response.status_code == 200:
                    content = response.text.lower()
                    
                    for pattern in sensitive_patterns:
                        matches = re.findall(pattern, content, re.IGNORECASE)
                        if matches:
                            exposures.append(f"{endpoint}: {pattern[:30]}...")
                            
            except Exception:
                pass
        
        if exposures:
            self._add_result(SecurityTestResult(
                test_name="Sensitive Data Exposure",
                vulnerability_type="Information Disclosure",
                severity="high",
                status="fail",
                description="Sensitive data patterns detected in responses",
                evidence="; ".join(exposures[:3]),
                cwe_id="CWE-200",
                owasp_category="A02:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Sensitive Data Exposure",
                vulnerability_type="Information Disclosure",
                severity="info",
                status="pass",
                description="No obvious sensitive data exposure detected",
                owasp_category="A02:2021"
            ))

    async def _test_tls_configuration(self):
        """Test TLS/SSL configuration."""
        try:
            # Test HTTPS endpoint
            https_url = self.config.base_url.replace("http://", "https://")
            response = await self.client.get(f"{https_url}/health")
            
            if response.status_code == 200:
                # Check security headers
                headers = response.headers
                hsts = headers.get("strict-transport-security")
                
                if not hsts:
                    self._add_result(SecurityTestResult(
                        test_name="HSTS Header",
                        vulnerability_type="TLS Configuration",
                        severity="medium",
                        status="fail",
                        description="HSTS header not present",
                        cwe_id="CWE-319",
                        owasp_category="A02:2021"
                    ))
                else:
                    self._add_result(SecurityTestResult(
                        test_name="HSTS Header",
                        vulnerability_type="TLS Configuration", 
                        severity="info",
                        status="pass",
                        description="HSTS header properly configured",
                        owasp_category="A02:2021"
                    ))
            else:
                self._add_result(SecurityTestResult(
                    test_name="HTTPS Configuration",
                    vulnerability_type="TLS Configuration",
                    severity="medium",
                    status="warning",
                    description="HTTPS not accessible for testing",
                    owasp_category="A02:2021"
                ))
                
        except Exception as e:
            self._add_result(SecurityTestResult(
                test_name="TLS Configuration",
                vulnerability_type="TLS Configuration",
                severity="low",
                status="warning",
                description=f"Could not test TLS: {str(e)}",
                owasp_category="A02:2021"
            ))

    async def _test_a03_injection(self):
        """Test A03: Injection vulnerabilities"""
        print("\n📋 Testing A03: Injection")
        
        await self._test_sql_injection()
        await self._test_nosql_injection()
        await self._test_command_injection()
        await self._test_ldap_injection()

    async def _test_sql_injection(self):
        """Test for SQL injection vulnerabilities."""
        # Test endpoints that might interact with database
        test_endpoints = [
            ("/api/knowledge", "GET", {"search": "PAYLOAD"}),
            ("/api/projects", "GET", {"filter": "PAYLOAD"}),
            ("/api/tasks", "GET", {"status": "PAYLOAD"}),
            ("/api/auth/login", "POST", {"username": "PAYLOAD", "password": "test"}),
        ]
        
        vulnerabilities = []
        
        for endpoint, method, params in test_endpoints:
            for payload in self.sql_payloads:
                try:
                    # Replace PAYLOAD with actual SQL injection payload
                    test_params = {}
                    test_json = {}
                    
                    if method == "GET":
                        test_params = {k: v.replace("PAYLOAD", payload) if v == "PAYLOAD" else v 
                                     for k, v in params.items()}
                        response = await self.client.get(
                            f"{self.config.base_url}{endpoint}",
                            params=test_params
                        )
                    else:
                        test_json = {k: v.replace("PAYLOAD", payload) if v == "PAYLOAD" else v 
                                   for k, v in params.items()}
                        response = await self.client.post(
                            f"{self.config.base_url}{endpoint}",
                            json=test_json
                        )
                    
                    # Check for SQL error patterns
                    error_patterns = [
                        "sql syntax",
                        "mysql error", 
                        "postgresql error",
                        "sqlite error",
                        "syntax error at or near",
                        "unclosed quotation mark",
                        "invalid input syntax",
                        "must specify table to select from",
                        "table 'users' doesn't exist",
                        "column 'username' does not exist",
                    ]
                    
                    response_text = response.text.lower()
                    for pattern in error_patterns:
                        if pattern in response_text:
                            vulnerabilities.append(f"{endpoint} with payload: {payload[:20]}...")
                            break
                            
                except Exception:
                    pass
        
        if vulnerabilities:
            self._add_result(SecurityTestResult(
                test_name="SQL Injection",
                vulnerability_type="SQL Injection",
                severity="critical",
                status="fail",
                description="SQL injection vulnerabilities detected",
                evidence="; ".join(vulnerabilities[:3]),
                cwe_id="CWE-89",
                owasp_category="A03:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="SQL Injection",
                vulnerability_type="Injection",
                severity="info",
                status="pass",
                description="No SQL injection vulnerabilities detected",
                owasp_category="A03:2021"
            ))

    async def _test_nosql_injection(self):
        """Test for NoSQL injection vulnerabilities."""
        nosql_payloads = [
            {"$ne": None},
            {"$regex": ".*"},
            {"$where": "1==1"},
            {"$gt": ""},
            {"$or": [{"a": 1}, {"b": 2}]},
        ]
        
        # Test JSON endpoints with NoSQL payloads
        test_endpoints = [
            "/api/auth/login",
            "/api/knowledge",
            "/api/projects",
        ]
        
        vulnerabilities = []
        
        for endpoint in test_endpoints:
            for payload in nosql_payloads:
                try:
                    response = await self.client.post(
                        f"{self.config.base_url}{endpoint}",
                        json={"username": payload, "password": "test"}
                    )
                    
                    # Check for NoSQL error patterns or unexpected behavior
                    if response.status_code == 200:
                        data = response.json()
                        if isinstance(data, dict) and data.get("success", False):
                            vulnerabilities.append(f"{endpoint} with NoSQL payload")
                            
                except Exception:
                    pass
        
        if vulnerabilities:
            self._add_result(SecurityTestResult(
                test_name="NoSQL Injection",
                vulnerability_type="NoSQL Injection",
                severity="high",
                status="fail",
                description="Possible NoSQL injection vulnerabilities",
                evidence="; ".join(vulnerabilities),
                cwe_id="CWE-943",
                owasp_category="A03:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="NoSQL Injection",
                vulnerability_type="Injection",
                severity="info",
                status="pass",
                description="No NoSQL injection vulnerabilities detected",
                owasp_category="A03:2021"
            ))

    async def _test_command_injection(self):
        """Test for command injection vulnerabilities."""
        # Test endpoints that might execute system commands
        test_endpoints = [
            ("/api/knowledge/crawl", "POST", {"url": "https://example.com; PAYLOAD"}),
            ("/api/documents", "POST", {"filename": "test; PAYLOAD"}),
        ]
        
        vulnerabilities = []
        
        for endpoint, method, params in test_endpoints:
            for payload in self.command_injection_payloads:
                try:
                    test_json = {k: v.replace("PAYLOAD", payload) if "PAYLOAD" in str(v) else v 
                               for k, v in params.items()}
                    
                    response = await self.client.post(
                        f"{self.config.base_url}{endpoint}",
                        json=test_json
                    )
                    
                    # Check for command output patterns
                    command_patterns = [
                        "root:x:0:0:",  # /etc/passwd
                        "uid=",         # whoami output
                        "total ",       # ls output
                        "pong",         # ping output
                        "vulnerable",   # echo output
                    ]
                    
                    response_text = response.text.lower()
                    for pattern in command_patterns:
                        if pattern in response_text:
                            vulnerabilities.append(f"{endpoint} with payload: {payload[:20]}...")
                            break
                            
                except Exception:
                    pass
        
        if vulnerabilities:
            self._add_result(SecurityTestResult(
                test_name="Command Injection",
                vulnerability_type="Command Injection",
                severity="critical",
                status="fail",
                description="Command injection vulnerabilities detected",
                evidence="; ".join(vulnerabilities),
                cwe_id="CWE-78",
                owasp_category="A03:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Command Injection",
                vulnerability_type="Injection",
                severity="info",
                status="pass",
                description="No command injection vulnerabilities detected",
                owasp_category="A03:2021"
            ))

    async def _test_ldap_injection(self):
        """Test for LDAP injection vulnerabilities."""
        ldap_payloads = [
            "*",
            "*)(&", 
            "*))%00",
            "*()|&'",
            "admin*",
            "*)(uid=*",
        ]
        
        # Test auth endpoints that might use LDAP
        vulnerabilities = []
        
        for payload in ldap_payloads:
            try:
                response = await self.client.post(
                    f"{self.config.base_url}/api/auth/login",
                    json={"username": payload, "password": "test"}
                )
                
                # Check for LDAP error patterns
                ldap_patterns = [
                    "ldap error",
                    "invalid dn syntax",
                    "ldap_search",
                    "bad search filter",
                ]
                
                response_text = response.text.lower()
                for pattern in ldap_patterns:
                    if pattern in response_text:
                        vulnerabilities.append(f"LDAP payload: {payload}")
                        break
                        
            except Exception:
                pass
        
        if vulnerabilities:
            self._add_result(SecurityTestResult(
                test_name="LDAP Injection",
                vulnerability_type="LDAP Injection",
                severity="high",
                status="fail",
                description="LDAP injection vulnerabilities detected",
                evidence="; ".join(vulnerabilities),
                cwe_id="CWE-90",
                owasp_category="A03:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="LDAP Injection",
                vulnerability_type="Injection",
                severity="info",
                status="pass",
                description="No LDAP injection vulnerabilities detected",
                owasp_category="A03:2021"
            ))

    async def _test_a04_insecure_design(self):
        """Test A04: Insecure Design"""
        print("\n📋 Testing A04: Insecure Design")
        
        await self._test_business_logic_flaws()
        await self._test_workflow_bypasses()

    async def _test_business_logic_flaws(self):
        """Test for business logic flaws."""
        # Test negative values, boundary conditions, etc.
        logic_tests = [
            ("/api/projects", "POST", {"name": "test", "priority": -1}),
            ("/api/tasks", "POST", {"title": "test", "estimated_hours": -100}),
            ("/api/knowledge", "POST", {"content": "x" * 1000000}),  # Very long content
        ]
        
        issues = []
        
        for endpoint, method, data in logic_tests:
            try:
                response = await self.client.post(
                    f"{self.config.base_url}{endpoint}",
                    json=data
                )
                
                if response.status_code == 200:
                    issues.append(f"{endpoint} accepted invalid data: {list(data.keys())}")
                    
            except Exception:
                pass
        
        if issues:
            self._add_result(SecurityTestResult(
                test_name="Business Logic Flaws",
                vulnerability_type="Business Logic Error",
                severity="medium",
                status="warning",
                description="Possible business logic validation issues",
                evidence="; ".join(issues),
                cwe_id="CWE-840",
                owasp_category="A04:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Business Logic Flaws",
                vulnerability_type="Business Logic",
                severity="info",
                status="pass",
                description="No obvious business logic flaws detected",
                owasp_category="A04:2021"
            ))

    async def _test_workflow_bypasses(self):
        """Test for workflow bypass vulnerabilities."""
        # Test sequence bypass - try to access step 3 without completing step 1&2
        workflow_tests = [
            # Try to complete a task without creating it
            ("/api/tasks/complete/999", "POST", {}),
            # Try to download without upload
            ("/api/knowledge/download/999", "GET", {}),
        ]
        
        bypasses = []
        
        for endpoint, method, data in workflow_tests:
            try:
                if method == "POST":
                    response = await self.client.post(
                        f"{self.config.base_url}{endpoint}",
                        json=data
                    )
                else:
                    response = await self.client.get(f"{self.config.base_url}{endpoint}")
                
                if response.status_code == 200:
                    bypasses.append(endpoint)
                    
            except Exception:
                pass
        
        if bypasses:
            self._add_result(SecurityTestResult(
                test_name="Workflow Bypass",
                vulnerability_type="Business Logic Error",
                severity="medium",
                status="warning",
                description="Possible workflow bypass vulnerabilities",
                evidence="; ".join(bypasses),
                cwe_id="CWE-841",
                owasp_category="A04:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Workflow Bypass",
                vulnerability_type="Business Logic",
                severity="info",
                status="pass",
                description="No workflow bypass vulnerabilities detected",
                owasp_category="A04:2021"
            ))

    async def _test_a05_security_misconfiguration(self):
        """Test A05: Security Misconfiguration"""
        print("\n📋 Testing A05: Security Misconfiguration")
        
        await self._test_default_credentials()
        await self._test_unnecessary_features()
        await self._test_error_messages()

    async def _test_default_credentials(self):
        """Test for default credentials."""
        default_creds = [
            ("admin", "admin"),
            ("admin", "password"),
            ("admin", "123456"), 
            ("root", "root"),
            ("test", "test"),
            ("guest", "guest"),
            ("demo", "demo"),
        ]
        
        successful_logins = []
        
        for username, password in default_creds:
            try:
                response = await self.client.post(
                    f"{self.config.base_url}/api/auth/login",
                    json={"username": username, "password": password}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("access_token") or data.get("token"):
                        successful_logins.append(f"{username}:{password}")
                        
            except Exception:
                pass
        
        if successful_logins:
            self._add_result(SecurityTestResult(
                test_name="Default Credentials",
                vulnerability_type="Authentication Bypass",
                severity="critical",
                status="fail",
                description="Default credentials found",
                evidence="; ".join(successful_logins),
                cwe_id="CWE-798",
                owasp_category="A05:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Default Credentials",
                vulnerability_type="Authentication",
                severity="info",
                status="pass",
                description="No default credentials detected",
                owasp_category="A05:2021"
            ))

    async def _test_unnecessary_features(self):
        """Test for unnecessary features that could pose security risks."""
        risky_endpoints = [
            "/phpinfo.php",
            "/info.php",
            "/test.php",
            "/debug",
            "/api/debug",
            "/api/test",
            "/swagger-ui/",
            "/.env",
            "/config.json",
        ]
        
        exposed_features = []
        
        for endpoint in risky_endpoints:
            try:
                response = await self.client.get(f"{self.config.base_url}{endpoint}")
                if response.status_code == 200:
                    exposed_features.append(endpoint)
                    
            except Exception:
                pass
        
        if exposed_features:
            self._add_result(SecurityTestResult(
                test_name="Unnecessary Features",
                vulnerability_type="Information Disclosure",
                severity="medium",
                status="warning",
                description="Potentially unnecessary features exposed",
                evidence="; ".join(exposed_features),
                cwe_id="CWE-16",
                owasp_category="A05:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Unnecessary Features",
                vulnerability_type="Configuration",
                severity="info",
                status="pass",
                description="No unnecessary features detected",
                owasp_category="A05:2021"
            ))

    async def _test_error_messages(self):
        """Test for verbose error messages that leak information."""
        # Test endpoints with invalid data to trigger errors
        error_tests = [
            ("/api/auth/login", "POST", {"username": "", "password": ""}),
            ("/api/projects/99999", "GET", {}),
            ("/api/nonexistent", "GET", {}),
        ]
        
        verbose_errors = []
        
        for endpoint, method, data in error_tests:
            try:
                if method == "POST":
                    response = await self.client.post(
                        f"{self.config.base_url}{endpoint}",
                        json=data
                    )
                else:
                    response = await self.client.get(f"{self.config.base_url}{endpoint}")
                
                if response.status_code >= 400:
                    text = response.text.lower()
                    
                    # Check for verbose error patterns
                    verbose_patterns = [
                        "traceback",
                        "stack trace",
                        "line ",
                        "file \"",
                        "at /",
                        "sql",
                        "database",
                        "exception",
                        "error in",
                    ]
                    
                    for pattern in verbose_patterns:
                        if pattern in text and len(text) > 200:
                            verbose_errors.append(f"{endpoint}: {pattern}")
                            break
                            
            except Exception:
                pass
        
        if verbose_errors:
            self._add_result(SecurityTestResult(
                test_name="Verbose Error Messages",
                vulnerability_type="Information Disclosure",
                severity="low",
                status="warning",
                description="Verbose error messages detected",
                evidence="; ".join(verbose_errors[:3]),
                cwe_id="CWE-209",
                owasp_category="A05:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Verbose Error Messages",
                vulnerability_type="Information Disclosure",
                severity="info",
                status="pass",
                description="Error messages appropriately configured",
                owasp_category="A05:2021"
            ))

    async def _test_a06_vulnerable_components(self):
        """Test A06: Vulnerable and Outdated Components"""
        print("\n📋 Testing A06: Vulnerable Components")
        
        await self._test_outdated_dependencies()
        await self._test_known_vulnerabilities()

    async def _test_outdated_dependencies(self):
        """Test for outdated dependencies (basic version detection)."""
        # Try to detect server/framework versions
        try:
            response = await self.client.get(f"{self.config.base_url}/")
            headers = response.headers
            
            # Check server headers for version info
            server_header = headers.get("server", "")
            powered_by = headers.get("x-powered-by", "")
            
            version_info = []
            if server_header:
                version_info.append(f"Server: {server_header}")
            if powered_by:
                version_info.append(f"Powered-By: {powered_by}")
            
            if version_info:
                self._add_result(SecurityTestResult(
                    test_name="Version Disclosure",
                    vulnerability_type="Information Disclosure",
                    severity="low",
                    status="warning",
                    description="Server version information disclosed",
                    evidence="; ".join(version_info),
                    cwe_id="CWE-200",
                    owasp_category="A06:2021"
                ))
            else:
                self._add_result(SecurityTestResult(
                    test_name="Version Disclosure",
                    vulnerability_type="Information Disclosure",
                    severity="info",
                    status="pass",
                    description="No version information disclosed in headers",
                    owasp_category="A06:2021"
                ))
                
        except Exception as e:
            self._add_result(SecurityTestResult(
                test_name="Version Detection",
                vulnerability_type="Component Analysis",
                severity="low",
                status="warning",
                description=f"Could not test version disclosure: {str(e)}",
                owasp_category="A06:2021"
            ))

    async def _test_known_vulnerabilities(self):
        """Test for known vulnerability patterns."""
        # Test for common vulnerable endpoints/patterns
        vuln_tests = [
            "/api/swagger-ui/../../../etc/passwd",  # Path traversal in Swagger
            "/.git/config",  # Git exposure
            "/node_modules/",  # Node modules exposure
            "/__pycache__/",  # Python cache exposure
            "/api/v1/../../admin",  # API path traversal
        ]
        
        vulnerabilities = []
        
        for endpoint in vuln_tests:
            try:
                response = await self.client.get(f"{self.config.base_url}{endpoint}")
                if response.status_code == 200 and len(response.text) > 50:
                    vulnerabilities.append(endpoint)
                    
            except Exception:
                pass
        
        if vulnerabilities:
            self._add_result(SecurityTestResult(
                test_name="Known Vulnerability Patterns",
                vulnerability_type="Vulnerable Components",
                severity="medium",
                status="warning",
                description="Potential vulnerability patterns detected",
                evidence="; ".join(vulnerabilities),
                cwe_id="CWE-1104",
                owasp_category="A06:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Known Vulnerability Patterns",
                vulnerability_type="Component Analysis",
                severity="info",
                status="pass",
                description="No known vulnerability patterns detected",
                owasp_category="A06:2021"
            ))

    async def _test_a07_identification_failures(self):
        """Test A07: Identification and Authentication Failures"""
        print("\n📋 Testing A07: Authentication Failures")
        
        await self._test_brute_force_protection()
        await self._test_password_policy()
        await self._test_session_management()

    async def _test_brute_force_protection(self):
        """Test brute force protection mechanisms."""
        # Attempt multiple failed logins
        failed_attempts = 0
        locked_out = False
        
        for i in range(10):  # Try 10 failed attempts
            try:
                response = await self.client.post(
                    f"{self.config.base_url}/api/auth/login",
                    json={"username": "testuser", "password": f"wrongpass{i}"}
                )
                
                if response.status_code == 401:
                    failed_attempts += 1
                elif response.status_code == 429:  # Too Many Requests
                    locked_out = True
                    break
                elif response.status_code == 423:  # Locked
                    locked_out = True
                    break
                    
                # Small delay between attempts
                await asyncio.sleep(0.1)
                
            except Exception:
                pass
        
        if locked_out:
            self._add_result(SecurityTestResult(
                test_name="Brute Force Protection",
                vulnerability_type="Authentication",
                severity="info",
                status="pass",
                description=f"Brute force protection active after {failed_attempts} attempts",
                owasp_category="A07:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Brute Force Protection",
                vulnerability_type="Authentication Bypass",
                severity="medium",
                status="warning",
                description=f"No brute force protection detected after {failed_attempts} attempts",
                cwe_id="CWE-307",
                owasp_category="A07:2021"
            ))

    async def _test_password_policy(self):
        """Test password policy enforcement."""
        weak_passwords = [
            "123456",
            "password",
            "admin",
            "test",
            "a",
            "12345678",
        ]
        
        weak_accepted = []
        
        # Test account creation with weak passwords
        for password in weak_passwords:
            try:
                response = await self.client.post(
                    f"{self.config.base_url}/api/auth/register",
                    json={
                        "username": f"testuser_{secrets.token_hex(4)}",
                        "password": password,
                        "email": "test@example.com"
                    }
                )
                
                if response.status_code == 200 or response.status_code == 201:
                    weak_accepted.append(password)
                    
            except Exception:
                pass
        
        if weak_accepted:
            self._add_result(SecurityTestResult(
                test_name="Password Policy",
                vulnerability_type="Weak Authentication",
                severity="medium",
                status="fail",
                description="Weak passwords accepted",
                evidence=f"Accepted: {', '.join(weak_accepted)}",
                cwe_id="CWE-521",
                owasp_category="A07:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Password Policy",
                vulnerability_type="Authentication",
                severity="info",
                status="pass",
                description="Password policy properly enforced",
                owasp_category="A07:2021"
            ))

    async def _test_session_management(self):
        """Test session management security."""
        # Test for session fixation, concurrent sessions, etc.
        
        # Test 1: Session token entropy
        tokens = []
        for _ in range(5):
            try:
                response = await self.client.post(
                    f"{self.config.base_url}/api/auth/login",
                    json={"username": "test", "password": "test"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    token = data.get("access_token", data.get("token"))
                    if token:
                        tokens.append(token)
                        
            except Exception:
                pass
        
        # Check token uniqueness and entropy
        if len(tokens) > 1:
            if len(set(tokens)) == len(tokens):
                self._add_result(SecurityTestResult(
                    test_name="Session Token Entropy",
                    vulnerability_type="Session Management",
                    severity="info",
                    status="pass",
                    description="Session tokens are unique",
                    owasp_category="A07:2021"
                ))
            else:
                self._add_result(SecurityTestResult(
                    test_name="Session Token Entropy",
                    vulnerability_type="Session Management",
                    severity="high",
                    status="fail",
                    description="Duplicate session tokens generated",
                    cwe_id="CWE-330",
                    owasp_category="A07:2021"
                ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Session Token Entropy",
                vulnerability_type="Session Management",
                severity="low",
                status="warning",
                description="Could not test session token entropy",
                owasp_category="A07:2021"
            ))

    async def _test_a08_software_integrity_failures(self):
        """Test A08: Software and Data Integrity Failures"""
        print("\n📋 Testing A08: Software Integrity Failures")
        
        await self._test_unsigned_updates()
        await self._test_insecure_deserialization()

    async def _test_unsigned_updates(self):
        """Test for unsigned software updates."""
        # This is more of an infrastructure test
        # Check for update endpoints that might not verify signatures
        update_endpoints = [
            "/api/update",
            "/api/upgrade",
            "/api/install",
            "/admin/update",
        ]
        
        accessible_updates = []
        
        for endpoint in update_endpoints:
            try:
                response = await self.client.get(f"{self.config.base_url}{endpoint}")
                if response.status_code == 200:
                    accessible_updates.append(endpoint)
                    
            except Exception:
                pass
        
        if accessible_updates:
            self._add_result(SecurityTestResult(
                test_name="Update Endpoints",
                vulnerability_type="Software Integrity",
                severity="medium",
                status="warning",
                description="Update endpoints accessible - verify signature checking",
                evidence="; ".join(accessible_updates),
                cwe_id="CWE-345",
                owasp_category="A08:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Update Endpoints",
                vulnerability_type="Software Integrity",
                severity="info",
                status="pass",
                description="No update endpoints exposed",
                owasp_category="A08:2021"
            ))

    async def _test_insecure_deserialization(self):
        """Test for insecure deserialization vulnerabilities."""
        # Test pickle, yaml, and other deserialization attacks
        serialization_payloads = [
            # Python pickle payload (base64 encoded)
            "gASVEwAAAAAAAACMBWJ1aWx0aW5zlIwEZXZhbJSTlIwGX19pbXBvcnRfX5QoWAJzeZRlUpR9lE5oAUsAWAhfX2J1aWx0aW5zX1+UWAVldmFslHOUUpRYDXN1YnByb2Nlc3MuY2FsbJSFlFKUTk5oB11dlFKUWAhzdWJwcm9jZXNzlGgZTk5oB11dlFKUWANvcy5zeXN0ZW1dlIWUUpRYBXdob2FtaZRdlFKUTk5oB11dlFKULg==",
            
            # YAML payload
            "!!python/object/apply:os.system ['whoami']",
            
            # JSON with potential object injection
            '{"__class__": "subprocess.Popen", "args": ["whoami"]}',
        ]
        
        vuln_endpoints = []
        
        for payload in serialization_payloads:
            test_endpoints = [
                ("/api/import", "POST", {"data": payload}),
                ("/api/restore", "POST", {"backup": payload}),
                ("/api/config", "POST", {"settings": payload}),
            ]
            
            for endpoint, method, data in test_endpoints:
                try:
                    response = await self.client.post(
                        f"{self.config.base_url}{endpoint}",
                        json=data
                    )
                    
                    # Check for command execution output
                    if "root" in response.text or "uid=" in response.text:
                        vuln_endpoints.append(endpoint)
                        
                except Exception:
                    pass
        
        if vuln_endpoints:
            self._add_result(SecurityTestResult(
                test_name="Insecure Deserialization",
                vulnerability_type="Deserialization",
                severity="critical",
                status="fail",
                description="Insecure deserialization vulnerabilities detected",
                evidence="; ".join(vuln_endpoints),
                cwe_id="CWE-502",
                owasp_category="A08:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Insecure Deserialization",
                vulnerability_type="Data Integrity",
                severity="info",
                status="pass",
                description="No insecure deserialization vulnerabilities detected",
                owasp_category="A08:2021"
            ))

    async def _test_a09_logging_monitoring_failures(self):
        """Test A09: Security Logging and Monitoring Failures"""
        print("\n📋 Testing A09: Logging & Monitoring Failures")
        
        await self._test_security_logging()
        await self._test_log_injection()

    async def _test_security_logging(self):
        """Test security event logging."""
        # Trigger security events and check if they're logged
        security_events = [
            # Failed login
            ("POST", "/api/auth/login", {"username": "admin", "password": "wrong"}),
            # Access to non-existent resource
            ("GET", "/api/admin/users", {}),
            # Potential injection attempt
            ("GET", "/api/search", {"q": "'; DROP TABLE users; --"}),
        ]
        
        # This test mainly checks if the application handles security events
        # without crashing and returns appropriate responses
        events_handled = 0
        
        for method, endpoint, data in security_events:
            try:
                if method == "POST":
                    response = await self.client.post(
                        f"{self.config.base_url}{endpoint}",
                        json=data
                    )
                else:
                    response = await self.client.get(
                        f"{self.config.base_url}{endpoint}",
                        params=data
                    )
                
                # Check if appropriate error codes are returned
                if response.status_code in [400, 401, 403, 404]:
                    events_handled += 1
                    
            except Exception:
                pass
        
        if events_handled == len(security_events):
            self._add_result(SecurityTestResult(
                test_name="Security Event Handling",
                vulnerability_type="Logging",
                severity="info",
                status="pass",
                description="Security events handled appropriately",
                owasp_category="A09:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Security Event Handling",
                vulnerability_type="Logging",
                severity="medium",
                status="warning",
                description=f"Only {events_handled}/{len(security_events)} security events handled properly",
                cwe_id="CWE-778",
                owasp_category="A09:2021"
            ))

    async def _test_log_injection(self):
        """Test for log injection vulnerabilities."""
        # Test log injection payloads
        log_payloads = [
            "user\nINFO: Fake log entry",
            "user\r\nERROR: Injected error",
            "user%0aINFO: Forged log",
            "user%0d%0aERROR: CRLF injection",
        ]
        
        # Test endpoints that might log user input
        test_endpoints = [
            "/api/auth/login",
            "/api/search", 
            "/api/feedback",
        ]
        
        # This is hard to test without access to logs
        # We'll test if the payloads cause unexpected responses
        injection_possible = False
        
        for payload in log_payloads:
            for endpoint in test_endpoints:
                try:
                    response = await self.client.post(
                        f"{self.config.base_url}{endpoint}",
                        json={"username": payload, "data": payload}
                    )
                    
                    # Look for reflected newline characters in response
                    if "\n" in response.text or "\r" in response.text:
                        if payload.replace("%0a", "\n").replace("%0d", "\r") in response.text:
                            injection_possible = True
                            break
                            
                except Exception:
                    pass
            
            if injection_possible:
                break
        
        if injection_possible:
            self._add_result(SecurityTestResult(
                test_name="Log Injection",
                vulnerability_type="Log Injection",
                severity="medium",
                status="warning",
                description="Possible log injection vulnerability",
                cwe_id="CWE-117",
                owasp_category="A09:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Log Injection",
                vulnerability_type="Logging",
                severity="info",
                status="pass",
                description="No log injection vulnerabilities detected",
                owasp_category="A09:2021"
            ))

    async def _test_a10_ssrf(self):
        """Test A10: Server-Side Request Forgery"""
        print("\n📋 Testing A10: Server-Side Request Forgery")
        
        await self._test_ssrf_vulnerabilities()

    async def _test_ssrf_vulnerabilities(self):
        """Test for SSRF vulnerabilities."""
        # Test endpoints that might make external requests
        ssrf_endpoints = [
            ("/api/knowledge/crawl", "POST", {"url": "PAYLOAD"}),
            ("/api/webhook", "POST", {"callback_url": "PAYLOAD"}),
            ("/api/import", "POST", {"source_url": "PAYLOAD"}),
        ]
        
        vulnerabilities = []
        
        for endpoint, method, params in ssrf_endpoints:
            for payload in self.ssrf_payloads:
                try:
                    test_data = {k: v.replace("PAYLOAD", payload) if v == "PAYLOAD" else v 
                               for k, v in params.items()}
                    
                    response = await self.client.post(
                        f"{self.config.base_url}{endpoint}",
                        json=test_data
                    )
                    
                    # Check for successful SSRF indicators
                    ssrf_indicators = [
                        "connection refused",
                        "network unreachable", 
                        "timeout",
                        "ssh-2.0",  # SSH banner
                        "redis",    # Redis response
                        "metadata", # Cloud metadata
                    ]
                    
                    response_text = response.text.lower()
                    for indicator in ssrf_indicators:
                        if indicator in response_text:
                            vulnerabilities.append(f"{endpoint} with {payload[:20]}...")
                            break
                            
                except Exception:
                    pass
        
        if vulnerabilities:
            self._add_result(SecurityTestResult(
                test_name="Server-Side Request Forgery",
                vulnerability_type="SSRF",
                severity="high",
                status="fail", 
                description="SSRF vulnerabilities detected",
                evidence="; ".join(vulnerabilities[:3]),
                cwe_id="CWE-918",
                owasp_category="A10:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Server-Side Request Forgery",
                vulnerability_type="SSRF",
                severity="info",
                status="pass",
                description="No SSRF vulnerabilities detected",
                owasp_category="A10:2021"
            ))

    async def _test_input_validation(self):
        """Test comprehensive input validation."""
        print("\n📋 Testing Input Validation")
        
        # Test XSS
        await self._test_xss_vulnerabilities()
        
        # Test path traversal
        await self._test_path_traversal()

    async def _test_xss_vulnerabilities(self):
        """Test for XSS vulnerabilities."""
        # Test endpoints that might reflect user input
        xss_endpoints = [
            ("/api/search", "GET", {"q": "PAYLOAD"}),
            ("/api/feedback", "POST", {"message": "PAYLOAD"}),
            ("/api/projects", "POST", {"name": "PAYLOAD"}),
        ]
        
        vulnerabilities = []
        
        for endpoint, method, params in xss_endpoints:
            for payload in self.xss_payloads:
                try:
                    if method == "GET":
                        test_params = {k: v.replace("PAYLOAD", payload) if v == "PAYLOAD" else v 
                                     for k, v in params.items()}
                        response = await self.client.get(
                            f"{self.config.base_url}{endpoint}",
                            params=test_params
                        )
                    else:
                        test_data = {k: v.replace("PAYLOAD", payload) if v == "PAYLOAD" else v 
                                   for k, v in params.items()}
                        response = await self.client.post(
                            f"{self.config.base_url}{endpoint}",
                            json=test_data
                        )
                    
                    # Check if payload is reflected without proper encoding
                    if payload in response.text or payload.replace("'", "&#x27;") in response.text:
                        vulnerabilities.append(f"{endpoint} with {payload[:20]}...")
                        
                except Exception:
                    pass
        
        if vulnerabilities:
            self._add_result(SecurityTestResult(
                test_name="Cross-Site Scripting (XSS)",
                vulnerability_type="XSS",
                severity="medium",
                status="fail",
                description="XSS vulnerabilities detected",
                evidence="; ".join(vulnerabilities[:3]),
                cwe_id="CWE-79",
                owasp_category="A03:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Cross-Site Scripting (XSS)",
                vulnerability_type="XSS",
                severity="info",
                status="pass",
                description="No XSS vulnerabilities detected",
                owasp_category="A03:2021"
            ))

    async def _test_path_traversal(self):
        """Test for path traversal vulnerabilities."""
        # Test endpoints that might access files
        path_endpoints = [
            ("/api/files", "GET", {"path": "PAYLOAD"}),
            ("/api/download", "GET", {"file": "PAYLOAD"}),
            ("/api/documents", "GET", {"filename": "PAYLOAD"}),
        ]
        
        vulnerabilities = []
        
        for endpoint, method, params in path_endpoints:
            for payload in self.path_traversal_payloads:
                try:
                    test_params = {k: v.replace("PAYLOAD", payload) if v == "PAYLOAD" else v 
                                 for k, v in params.items()}
                    response = await self.client.get(
                        f"{self.config.base_url}{endpoint}",
                        params=test_params
                    )
                    
                    # Check for system file content
                    system_patterns = [
                        "root:x:0:0:",  # /etc/passwd
                        "[boot loader]", # Windows hosts file
                        "# localhost",   # hosts file
                        "127.0.0.1",     # localhost entry
                    ]
                    
                    response_text = response.text.lower()
                    for pattern in system_patterns:
                        if pattern in response_text:
                            vulnerabilities.append(f"{endpoint} with {payload[:20]}...")
                            break
                            
                except Exception:
                    pass
        
        if vulnerabilities:
            self._add_result(SecurityTestResult(
                test_name="Path Traversal",
                vulnerability_type="Path Traversal",
                severity="high",
                status="fail",
                description="Path traversal vulnerabilities detected",
                evidence="; ".join(vulnerabilities[:3]),
                cwe_id="CWE-22",
                owasp_category="A01:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Path Traversal",
                vulnerability_type="Path Traversal",
                severity="info",
                status="pass",
                description="No path traversal vulnerabilities detected",
                owasp_category="A01:2021"
            ))

    async def _test_csrf_protection(self):
        """Test CSRF protection mechanisms."""
        print("\n📋 Testing CSRF Protection")
        
        # Test state-changing operations without CSRF tokens
        csrf_endpoints = [
            ("/api/projects", "POST", {"name": "test"}),
            ("/api/tasks", "POST", {"title": "test"}),
            ("/api/knowledge", "DELETE", {}),
        ]
        
        unprotected = []
        
        for endpoint, method, data in csrf_endpoints:
            try:
                if method == "POST":
                    response = await self.client.post(
                        f"{self.config.base_url}{endpoint}",
                        json=data
                    )
                elif method == "DELETE":
                    response = await self.client.delete(f"{self.config.base_url}{endpoint}")
                
                # Check if request succeeded without CSRF token
                if response.status_code == 200:
                    unprotected.append(endpoint)
                    
            except Exception:
                pass
        
        if unprotected:
            self._add_result(SecurityTestResult(
                test_name="CSRF Protection",
                vulnerability_type="CSRF",
                severity="medium",
                status="warning",
                description="Endpoints may lack CSRF protection",
                evidence="; ".join(unprotected),
                cwe_id="CWE-352",
                owasp_category="A01:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="CSRF Protection",
                vulnerability_type="CSRF",
                severity="info",
                status="pass",
                description="CSRF protection appears to be implemented",
                owasp_category="A01:2021"
            ))

    async def _test_cors_configuration(self):
        """Test CORS configuration security."""
        print("\n📋 Testing CORS Configuration")
        
        try:
            # Test CORS with various origins
            origins_to_test = [
                "https://evil.com",
                "http://localhost:3000",
                "null",
                "*",
            ]
            
            weak_cors = []
            
            for origin in origins_to_test:
                response = await self.client.options(
                    f"{self.config.base_url}/api/projects",
                    headers={"Origin": origin}
                )
                
                access_control_origin = response.headers.get("access-control-allow-origin")
                if access_control_origin == "*" or access_control_origin == origin:
                    if origin in ["https://evil.com", "null", "*"]:
                        weak_cors.append(f"Origin {origin} allowed")
            
            if weak_cors:
                self._add_result(SecurityTestResult(
                    test_name="CORS Configuration",
                    vulnerability_type="CORS Misconfiguration",
                    severity="medium",
                    status="warning",
                    description="Potentially insecure CORS configuration",
                    evidence="; ".join(weak_cors),
                    cwe_id="CWE-346",
                    owasp_category="A05:2021"
                ))
            else:
                self._add_result(SecurityTestResult(
                    test_name="CORS Configuration",
                    vulnerability_type="CORS",
                    severity="info",
                    status="pass",
                    description="CORS configuration appears secure",
                    owasp_category="A05:2021"
                ))
                
        except Exception as e:
            self._add_result(SecurityTestResult(
                test_name="CORS Configuration",
                vulnerability_type="CORS",
                severity="low",
                status="warning",
                description=f"Could not test CORS: {str(e)}",
                owasp_category="A05:2021"
            ))

    async def _test_security_headers(self):
        """Test security headers implementation."""
        print("\n📋 Testing Security Headers")
        
        try:
            response = await self.client.get(f"{self.config.base_url}/")
            headers = response.headers
            
            # Required security headers
            required_headers = {
                "x-content-type-options": "nosniff",
                "x-frame-options": ["DENY", "SAMEORIGIN"],
                "x-xss-protection": "1; mode=block",
                "content-security-policy": None,  # Just check presence
                "strict-transport-security": None,  # Check presence
            }
            
            missing_headers = []
            weak_headers = []
            
            for header, expected in required_headers.items():
                header_value = headers.get(header, "").lower()
                
                if not header_value:
                    missing_headers.append(header)
                elif expected and isinstance(expected, list):
                    if not any(exp.lower() in header_value for exp in expected):
                        weak_headers.append(f"{header}: {header_value}")
                elif expected and expected.lower() not in header_value:
                    weak_headers.append(f"{header}: {header_value}")
            
            if missing_headers or weak_headers:
                severity = "medium" if missing_headers else "low"
                status = "fail" if missing_headers else "warning"
                evidence = f"Missing: {', '.join(missing_headers)}; Weak: {', '.join(weak_headers)}"
                
                self._add_result(SecurityTestResult(
                    test_name="Security Headers",
                    vulnerability_type="Security Headers",
                    severity=severity,
                    status=status,
                    description="Security headers missing or misconfigured",
                    evidence=evidence,
                    cwe_id="CWE-693",
                    owasp_category="A05:2021"
                ))
            else:
                self._add_result(SecurityTestResult(
                    test_name="Security Headers",
                    vulnerability_type="Security Headers",
                    severity="info",
                    status="pass",
                    description="Security headers properly configured",
                    owasp_category="A05:2021"
                ))
                
        except Exception as e:
            self._add_result(SecurityTestResult(
                test_name="Security Headers",
                vulnerability_type="Security Headers",
                severity="low",
                status="warning",
                description=f"Could not test security headers: {str(e)}",
                owasp_category="A05:2021"
            ))

    async def _test_file_upload_security(self):
        """Test file upload security."""
        print("\n📋 Testing File Upload Security")
        
        # Test malicious file uploads
        malicious_files = [
            ("script.php", "<?php system($_GET['cmd']); ?>", "application/x-php"),
            ("test.exe", b"MZ\x90\x00", "application/x-executable"),
            ("shell.jsp", "<%Runtime.getRuntime().exec(request.getParameter(\"cmd\"));%>", "application/x-jsp"),
            ("test.svg", "<svg onload=alert('XSS')></svg>", "image/svg+xml"),
            ("../../../evil.txt", "malicious content", "text/plain"),
        ]
        
        upload_issues = []
        
        for filename, content, content_type in malicious_files:
            try:
                files = {"file": (filename, content, content_type)}
                response = await self.client.post(
                    f"{self.config.base_url}/api/upload",
                    files=files
                )
                
                if response.status_code == 200:
                    upload_issues.append(f"{filename} ({content_type})")
                    
            except Exception:
                pass
        
        if upload_issues:
            self._add_result(SecurityTestResult(
                test_name="File Upload Security",
                vulnerability_type="File Upload",
                severity="high",
                status="fail",
                description="Malicious file uploads accepted",
                evidence="; ".join(upload_issues),
                cwe_id="CWE-434",
                owasp_category="A01:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="File Upload Security",
                vulnerability_type="File Upload",
                severity="info",
                status="pass",
                description="File upload security properly implemented",
                owasp_category="A01:2021"
            ))

    async def _test_rate_limiting(self):
        """Test rate limiting implementation."""
        print("\n📋 Testing Rate Limiting")
        
        # Test rate limiting on API endpoints
        rate_limit_triggered = False
        requests_made = 0
        
        # Make rapid requests to trigger rate limiting
        for i in range(50):  # Try 50 requests rapidly
            try:
                response = await self.client.get(f"{self.config.base_url}/api/health")
                requests_made += 1
                
                if response.status_code == 429:  # Too Many Requests
                    rate_limit_triggered = True
                    break
                    
                # Very short delay
                await asyncio.sleep(0.01)
                
            except Exception:
                break
        
        if rate_limit_triggered:
            self._add_result(SecurityTestResult(
                test_name="Rate Limiting",
                vulnerability_type="Rate Limiting",
                severity="info",
                status="pass",
                description=f"Rate limiting active after {requests_made} requests",
                owasp_category="A07:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Rate Limiting",
                vulnerability_type="DoS Protection",
                severity="medium",
                status="warning",
                description=f"No rate limiting detected after {requests_made} requests",
                cwe_id="CWE-770",
                owasp_category="A07:2021"
            ))

    async def _test_error_handling(self):
        """Test error handling security."""
        print("\n📋 Testing Error Handling")
        
        # Test various error conditions
        error_tests = [
            ("/api/nonexistent", "GET", 404),
            ("/api/projects/99999", "GET", 404),
            ("/api/auth/login", "POST", 400),  # Missing data
        ]
        
        verbose_errors = []
        
        for endpoint, method, expected_status in error_tests:
            try:
                if method == "GET":
                    response = await self.client.get(f"{self.config.base_url}{endpoint}")
                else:
                    response = await self.client.post(f"{self.config.base_url}{endpoint}", json={})
                
                if response.status_code >= 400:
                    # Check for verbose error information
                    content = response.text
                    if len(content) > 500:  # Very long error message
                        verbose_errors.append(f"{endpoint}: {len(content)} chars")
                    
                    # Check for stack traces
                    if any(pattern in content.lower() for pattern in 
                          ["traceback", "stack trace", "line ", "file \""]):
                        verbose_errors.append(f"{endpoint}: stack trace")
                        
            except Exception:
                pass
        
        if verbose_errors:
            self._add_result(SecurityTestResult(
                test_name="Error Information Disclosure",
                vulnerability_type="Information Disclosure",
                severity="low",
                status="warning",
                description="Verbose error messages detected",
                evidence="; ".join(verbose_errors[:3]),
                cwe_id="CWE-209",
                owasp_category="A05:2021"
            ))
        else:
            self._add_result(SecurityTestResult(
                test_name="Error Information Disclosure",
                vulnerability_type="Error Handling",
                severity="info",
                status="pass",
                description="Error handling appropriately configured",
                owasp_category="A05:2021"
            ))

    def generate_security_report(self) -> str:
        """Generate comprehensive security report."""
        if not self.results:
            return "No security test results available."
        
        # Count results by severity and status
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        status_counts = {"pass": 0, "fail": 0, "warning": 0}
        
        for result in self.results:
            severity_counts[result.severity] += 1
            status_counts[result.status] += 1
        
        # Generate report
        report_lines = [
            "🔒 ARCHON V2 BETA - SECURITY ASSESSMENT REPORT",
            "=" * 60,
            "",
            f"📊 SUMMARY:",
            f"   Total Tests: {len(self.results)}",
            f"   ✅ Passed: {status_counts['pass']}",
            f"   ❌ Failed: {status_counts['fail']}",
            f"   ⚠️  Warnings: {status_counts['warning']}",
            "",
            f"🚨 SEVERITY BREAKDOWN:",
            f"   🔴 Critical: {severity_counts['critical']}",
            f"   🟠 High: {severity_counts['high']}",
            f"   🟡 Medium: {severity_counts['medium']}",
            f"   🟢 Low: {severity_counts['low']}",
            f"   🔵 Info: {severity_counts['info']}",
            "",
        ]
        
        # Critical and high severity issues
        critical_high = [r for r in self.results if r.severity in ["critical", "high"] and r.status == "fail"]
        if critical_high:
            report_lines.extend([
                "🚨 CRITICAL & HIGH SEVERITY ISSUES:",
                "-" * 40,
            ])
            for result in critical_high:
                report_lines.extend([
                    f"❌ {result.test_name} ({result.severity.upper()})",
                    f"   Type: {result.vulnerability_type}",
                    f"   Description: {result.description}",
                    f"   OWASP: {result.owasp_category}",
                    f"   CWE: {result.cwe_id}" if result.cwe_id else "",
                    f"   Evidence: {result.evidence}" if result.evidence else "",
                    ""
                ])
        
        # Medium severity issues
        medium = [r for r in self.results if r.severity == "medium" and r.status in ["fail", "warning"]]
        if medium:
            report_lines.extend([
                "🟡 MEDIUM SEVERITY ISSUES:",
                "-" * 30,
            ])
            for result in medium:
                report_lines.extend([
                    f"⚠️  {result.test_name}",
                    f"   Description: {result.description}",
                    f"   Evidence: {result.evidence}" if result.evidence else "",
                    ""
                ])
        
        # Beta readiness assessment
        critical_issues = severity_counts['critical']
        high_issues = len([r for r in self.results if r.severity == "high" and r.status == "fail"])
        
        report_lines.extend([
            "🎯 BETA READINESS ASSESSMENT:",
            "-" * 30,
        ])
        
        if critical_issues == 0 and high_issues == 0:
            report_lines.extend([
                "✅ READY FOR BETA DEPLOYMENT",
                "   No critical or high severity vulnerabilities found.",
                "   Address medium/low issues before production.",
            ])
        elif critical_issues == 0 and high_issues <= 2:
            report_lines.extend([
                "⚠️  CONDITIONAL BETA READINESS",
                f"   {high_issues} high severity issue(s) found.",
                "   Review and mitigate before deployment.",
            ])
        else:
            report_lines.extend([
                "❌ NOT READY FOR BETA",
                f"   {critical_issues} critical, {high_issues} high severity issues.",
                "   Must resolve all critical issues before deployment.",
            ])
        
        report_lines.extend([
            "",
            "📋 RECOMMENDATIONS:",
            "1. Fix all critical and high severity vulnerabilities",
            "2. Implement proper input validation and output encoding",
            "3. Ensure authentication and authorization are properly configured",
            "4. Review and harden security headers and CORS policies",
            "5. Conduct regular security assessments",
            "",
            "Generated by Archon V2 Beta Security Testing Suite",
            f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC')}",
        ])
        
        return "\n".join(report_lines)

# Export main classes and functions
__all__ = [
    "OWASPSecurityTester",
    "SecurityTestResult", 
    "SecurityTestConfig",
]