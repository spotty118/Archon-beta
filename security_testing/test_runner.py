#!/usr/bin/env python3
"""
OWASP Security Test Runner

Comprehensive security testing framework for Archon V2 Beta.
Executes OWASP Top 10 2021 vulnerability assessments with detailed reporting.

Usage:
    python test_runner.py --target http://localhost:8181 --output results.json
    python test_runner.py --config config.json --deep-scan
    python test_runner.py --test-categories sql_injection,xss,csrf
"""

import asyncio
import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging

# Import the security testing framework
from owasp_security_tests import OwaspSecurityTester
from config import SecurityTestConfig, OWASP_TOP_10_MAPPING, SEVERITY_LEVELS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('security_test.log')
    ]
)

logger = logging.getLogger(__name__)

class SecurityTestRunner:
    """Main test runner for OWASP security testing framework."""
    
    def __init__(self, config: SecurityTestConfig):
        """Initialize the test runner with configuration."""
        self.config = config
        self.tester = OwaspSecurityTester(config)
        self.results = {}
        self.start_time = None
        self.end_time = None
        
    async def run_all_tests(self, test_categories: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Run comprehensive security tests.
        
        Args:
            test_categories: List of specific test categories to run, or None for all
            
        Returns:
            Dictionary containing all test results and summary
        """
        logger.info("🔒 Starting OWASP Security Assessment")
        logger.info(f"Target: {self.config.base_url}")
        logger.info(f"API Endpoint: {self.config.api_base_url}")
        
        self.start_time = datetime.now()
        
        try:
            # Initialize the tester
            await self.tester.initialize()
            
            # Determine which tests to run
            if test_categories:
                available_tests = self._get_available_tests()
                tests_to_run = [test for test in test_categories if test in available_tests]
                if not tests_to_run:
                    raise ValueError(f"No valid test categories found. Available: {list(available_tests.keys())}")
                logger.info(f"Running selected tests: {tests_to_run}")
            else:
                tests_to_run = None
                logger.info("Running all available security tests")
            
            # Run the security tests
            results = await self.tester.run_security_tests(test_categories=tests_to_run)
            
            # Process and enhance results
            self.results = await self._process_results(results)
            
            # Generate summary
            summary = self._generate_summary()
            self.results['summary'] = summary
            
            # Log completion
            self.end_time = datetime.now()
            duration = (self.end_time - self.start_time).total_seconds()
            
            logger.info(f"✅ Security assessment completed in {duration:.2f} seconds")
            logger.info(f"Total vulnerabilities found: {summary['total_vulnerabilities']}")
            logger.info(f"Critical issues: {summary['critical_count']}")
            logger.info(f"High severity issues: {summary['high_count']}")
            
            return self.results
            
        except Exception as e:
            logger.error(f"❌ Security assessment failed: {str(e)}")
            self.end_time = datetime.now()
            
            # Create error result
            error_result = {
                'error': str(e),
                'timestamp': datetime.now().isoformat(),
                'config': {
                    'base_url': self.config.base_url,
                    'api_base_url': self.config.api_base_url
                }
            }
            
            return error_result
            
        finally:
            # Cleanup
            await self.tester.cleanup()
    
    async def run_specific_test(self, test_name: str) -> Dict[str, Any]:
        """
        Run a specific security test.
        
        Args:
            test_name: Name of the specific test to run
            
        Returns:
            Dictionary containing test results
        """
        logger.info(f"🎯 Running specific security test: {test_name}")
        
        self.start_time = datetime.now()
        
        try:
            await self.tester.initialize()
            
            # Map test names to methods
            test_method_map = {
                'sql_injection': self.tester._test_sql_injection,
                'xss': self.tester._test_xss_vulnerabilities,
                'csrf': self.tester._test_csrf_protection,
                'ssrf': self.tester._test_ssrf_vulnerabilities,
                'auth_bypass': self.tester._test_authentication_bypass,
                'authorization': self.tester._test_authorization_flaws,
                'input_validation': self.tester._test_input_validation,
                'file_upload': self.tester._test_file_upload_security,
                'path_traversal': self.tester._test_path_traversal,
                'command_injection': self.tester._test_command_injection,
                'security_headers': self.tester._test_security_headers,
                'session_management': self.tester._test_session_management,
                'error_handling': self.tester._test_error_handling,
                'business_logic': self.tester._test_business_logic_flaws,
            }
            
            if test_name not in test_method_map:
                raise ValueError(f"Unknown test: {test_name}. Available tests: {list(test_method_map.keys())}")
            
            # Run the specific test
            test_method = test_method_map[test_name]
            result = await test_method()
            
            # Wrap in standard format
            wrapped_result = {
                'test_name': test_name,
                'timestamp': datetime.now().isoformat(),
                'result': result,
                'config': {
                    'base_url': self.config.base_url,
                    'api_base_url': self.config.api_base_url
                }
            }
            
            self.end_time = datetime.now()
            duration = (self.end_time - self.start_time).total_seconds()
            
            logger.info(f"✅ Test '{test_name}' completed in {duration:.2f} seconds")
            
            return wrapped_result
            
        except Exception as e:
            logger.error(f"❌ Test '{test_name}' failed: {str(e)}")
            self.end_time = datetime.now()
            
            return {
                'test_name': test_name,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            
        finally:
            await self.tester.cleanup()
    
    def _get_available_tests(self) -> Dict[str, str]:
        """Get available test categories and their descriptions."""
        return {
            'sql_injection': 'SQL Injection vulnerability testing',
            'xss': 'Cross-Site Scripting (XSS) vulnerability testing',
            'csrf': 'Cross-Site Request Forgery (CSRF) protection testing',
            'ssrf': 'Server-Side Request Forgery (SSRF) vulnerability testing',
            'auth_bypass': 'Authentication bypass testing',
            'authorization': 'Authorization and access control testing',
            'input_validation': 'Input validation and sanitization testing',
            'file_upload': 'File upload security testing',
            'path_traversal': 'Path traversal vulnerability testing',
            'command_injection': 'Command injection vulnerability testing',
            'security_headers': 'Security headers configuration testing',
            'session_management': 'Session management security testing',
            'error_handling': 'Error handling and information disclosure testing',
            'business_logic': 'Business logic flaws testing',
        }
    
    async def _process_results(self, raw_results: Dict[str, Any]) -> Dict[str, Any]:
        """Process and enhance raw test results."""
        processed = {
            'metadata': {
                'test_framework': 'OWASP Security Tester v1.0',
                'target_url': self.config.base_url,
                'api_url': self.config.api_base_url,
                'test_start': self.start_time.isoformat(),
                'test_end': self.end_time.isoformat() if self.end_time else None,
                'configuration': {
                    'deep_scan': self.config.deep_scan,
                    'timeout': self.config.request_timeout,
                    'concurrency': self.config.max_concurrent_tests,
                }
            },
            'test_results': {},
            'vulnerabilities': [],
            'owasp_mapping': {}
        }
        
        # Process each test category
        for category, results in raw_results.items():
            if isinstance(results, dict) and 'vulnerabilities' in results:
                processed['test_results'][category] = results
                
                # Extract vulnerabilities
                for vuln in results['vulnerabilities']:
                    enhanced_vuln = {
                        **vuln,
                        'category': category,
                        'owasp_category': self._map_to_owasp_category(category),
                        'severity_info': SEVERITY_LEVELS.get(vuln.get('severity', 'MEDIUM'), {}),
                        'discovered_at': datetime.now().isoformat()
                    }
                    processed['vulnerabilities'].append(enhanced_vuln)
        
        # Generate OWASP Top 10 mapping
        processed['owasp_mapping'] = self._generate_owasp_mapping(processed['vulnerabilities'])
        
        return processed
    
    def _map_to_owasp_category(self, test_category: str) -> Optional[str]:
        """Map test category to OWASP Top 10 2021 category."""
        mapping = {
            'authorization': 'A01',
            'access_control': 'A01',
            'encryption': 'A02',
            'crypto': 'A02',
            'sql_injection': 'A03',
            'command_injection': 'A03',
            'business_logic': 'A04',
            'security_headers': 'A05',
            'error_handling': 'A05',
            'dependencies': 'A06',
            'auth_bypass': 'A07',
            'session_management': 'A07',
            'deserialization': 'A08',
            'logging': 'A09',
            'monitoring': 'A09',
            'ssrf': 'A10',
        }
        
        return mapping.get(test_category)
    
    def _generate_owasp_mapping(self, vulnerabilities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate OWASP Top 10 2021 mapping with vulnerability counts."""
        owasp_mapping = {}
        
        for owasp_id, owasp_info in OWASP_TOP_10_MAPPING.items():
            category_vulns = [v for v in vulnerabilities if v.get('owasp_category') == owasp_id]
            
            owasp_mapping[owasp_id] = {
                'name': owasp_info['name'],
                'vulnerability_count': len(category_vulns),
                'max_severity': self._get_max_severity(category_vulns),
                'vulnerabilities': category_vulns
            }
        
        return owasp_mapping
    
    def _get_max_severity(self, vulnerabilities: List[Dict[str, Any]]) -> str:
        """Get the maximum severity level from a list of vulnerabilities."""
        severity_order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
        
        for severity in severity_order:
            if any(v.get('severity') == severity for v in vulnerabilities):
                return severity
        
        return 'INFO'
    
    def _generate_summary(self) -> Dict[str, Any]:
        """Generate test summary with key metrics."""
        vulnerabilities = self.results.get('vulnerabilities', [])
        
        # Count by severity
        severity_counts = {}
        for severity in SEVERITY_LEVELS.keys():
            severity_counts[f"{severity.lower()}_count"] = len([
                v for v in vulnerabilities if v.get('severity') == severity
            ])
        
        # Count by OWASP category
        owasp_counts = {}
        for owasp_id in OWASP_TOP_10_MAPPING.keys():
            owasp_counts[f"owasp_{owasp_id.lower()}_count"] = len([
                v for v in vulnerabilities if v.get('owasp_category') == owasp_id
            ])
        
        # Calculate duration
        duration = 0
        if self.start_time and self.end_time:
            duration = (self.end_time - self.start_time).total_seconds()
        
        # Determine beta readiness
        critical_issues = severity_counts.get('critical_count', 0)
        high_issues = severity_counts.get('high_count', 0)
        
        beta_ready = critical_issues == 0  # Zero critical findings required
        
        summary = {
            'total_vulnerabilities': len(vulnerabilities),
            'beta_ready': beta_ready,
            'beta_readiness_message': 'Ready for beta deployment' if beta_ready else f'Not ready: {critical_issues} critical issues found',
            'test_duration_seconds': duration,
            'test_categories_run': len(self.results.get('test_results', {})),
            **severity_counts,
            **owasp_counts,
            'recommendations': self._generate_recommendations(vulnerabilities)
        }
        
        return summary
    
    def _generate_recommendations(self, vulnerabilities: List[Dict[str, Any]]) -> List[str]:
        """Generate actionable recommendations based on found vulnerabilities."""
        recommendations = []
        
        # Check for critical/high severity issues
        critical_count = len([v for v in vulnerabilities if v.get('severity') == 'CRITICAL'])
        high_count = len([v for v in vulnerabilities if v.get('severity') == 'HIGH'])
        
        if critical_count > 0:
            recommendations.append(f"URGENT: Address {critical_count} critical security vulnerabilities before beta deployment")
        
        if high_count > 0:
            recommendations.append(f"HIGH PRIORITY: Resolve {high_count} high-severity security issues")
        
        # Category-specific recommendations
        categories = set(v.get('category') for v in vulnerabilities)
        
        if 'sql_injection' in categories:
            recommendations.append("Implement parameterized queries and input validation to prevent SQL injection")
        
        if 'xss' in categories:
            recommendations.append("Add output encoding/escaping and Content Security Policy (CSP) to prevent XSS")
        
        if 'csrf' in categories:
            recommendations.append("Implement CSRF tokens for all state-changing operations")
        
        if 'ssrf' in categories:
            recommendations.append("Add URL validation and network access controls to prevent SSRF")
        
        if 'security_headers' in categories:
            recommendations.append("Configure all required security headers (HSTS, CSP, X-Frame-Options, etc.)")
        
        # General recommendations
        if len(vulnerabilities) > 0:
            recommendations.append("Conduct regular security code reviews and penetration testing")
            recommendations.append("Implement automated security testing in CI/CD pipeline")
        
        return recommendations

    def save_results(self, filename: Optional[str] = None) -> str:
        """Save test results to file."""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"security_test_results_{timestamp}.json"
        
        output_path = Path(self.config.output_directory) / filename
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        
        logger.info(f"📄 Results saved to: {output_path}")
        return str(output_path)
    
    def print_summary(self):
        """Print test summary to console."""
        if not self.results or 'summary' not in self.results:
            logger.error("No results available to summarize")
            return
        
        summary = self.results['summary']
        
        print("\n" + "="*80)
        print("🔒 OWASP SECURITY ASSESSMENT SUMMARY")
        print("="*80)
        
        print(f"Target: {self.config.base_url}")
        print(f"Duration: {summary['test_duration_seconds']:.2f} seconds")
        print(f"Test Categories: {summary['test_categories_run']}")
        
        print(f"\n📊 VULNERABILITY SUMMARY:")
        print(f"  Total Vulnerabilities: {summary['total_vulnerabilities']}")
        print(f"  Critical: {summary.get('critical_count', 0)}")
        print(f"  High: {summary.get('high_count', 0)}")
        print(f"  Medium: {summary.get('medium_count', 0)}")
        print(f"  Low: {summary.get('low_count', 0)}")
        print(f"  Info: {summary.get('info_count', 0)}")
        
        print(f"\n🎯 BETA READINESS:")
        readiness_status = "✅ READY" if summary['beta_ready'] else "❌ NOT READY"
        print(f"  Status: {readiness_status}")
        print(f"  Message: {summary['beta_readiness_message']}")
        
        if summary.get('recommendations'):
            print(f"\n💡 RECOMMENDATIONS:")
            for i, rec in enumerate(summary['recommendations'], 1):
                print(f"  {i}. {rec}")
        
        print("\n" + "="*80)

async def main():
    """Main entry point for the security test runner."""
    parser = argparse.ArgumentParser(
        description="OWASP Security Testing Framework for Archon V2 Beta",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python test_runner.py --target http://localhost:8181
  python test_runner.py --categories sql_injection,xss,csrf
  python test_runner.py --test sql_injection --output sql_results.json
  python test_runner.py --deep-scan --timeout 60
        """
    )
    
    parser.add_argument('--target', default='http://localhost:8181',
                       help='Target URL for security testing (default: http://localhost:8181)')
    parser.add_argument('--api-url', 
                       help='API base URL (default: <target>/api)')
    parser.add_argument('--categories', 
                       help='Comma-separated list of test categories to run')
    parser.add_argument('--test', 
                       help='Run a single specific test')
    parser.add_argument('--output', 
                       help='Output filename for results (default: auto-generated)')
    parser.add_argument('--config-file', 
                       help='Configuration file path (JSON format)')
    parser.add_argument('--deep-scan', action='store_true',
                       help='Enable deep scanning mode with additional tests')
    parser.add_argument('--timeout', type=int, default=30,
                       help='Request timeout in seconds (default: 30)')
    parser.add_argument('--concurrency', type=int, default=5,
                       help='Maximum concurrent tests (default: 5)')
    parser.add_argument('--list-tests', action='store_true',
                       help='List available test categories and exit')
    parser.add_argument('--quiet', action='store_true',
                       help='Suppress console output except errors')
    parser.add_argument('--verbose', action='store_true',
                       help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.quiet:
        logging.getLogger().setLevel(logging.ERROR)
    elif args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create configuration
    if args.config_file:
        with open(args.config_file, 'r') as f:
            config_data = json.load(f)
        config = SecurityTestConfig(**config_data)
    else:
        config = SecurityTestConfig.from_env()
    
    # Override with command line arguments
    config.base_url = args.target
    config.api_base_url = args.api_url or f"{args.target}/api"
    config.request_timeout = args.timeout
    config.max_concurrent_tests = args.concurrency
    config.deep_scan = args.deep_scan
    
    # Create test runner
    runner = SecurityTestRunner(config)
    
    # List available tests if requested
    if args.list_tests:
        tests = runner._get_available_tests()
        print("\n📋 Available Security Test Categories:")
        print("=" * 50)
        for test_name, description in tests.items():
            print(f"  {test_name:<20} - {description}")
        print("\n🎯 OWASP Top 10 2021 Mapping:")
        print("=" * 50)
        for owasp_id, owasp_info in OWASP_TOP_10_MAPPING.items():
            print(f"  {owasp_id} - {owasp_info['name']}")
        return
    
    try:
        # Run tests
        if args.test:
            # Run single test
            results = await runner.run_specific_test(args.test)
        elif args.categories:
            # Run specific categories
            categories = [cat.strip() for cat in args.categories.split(',')]
            results = await runner.run_all_tests(test_categories=categories)
        else:
            # Run all tests
            results = await runner.run_all_tests()
        
        # Save results
        output_file = runner.save_results(args.output)
        
        # Print summary if not quiet
        if not args.quiet:
            runner.print_summary()
        
        # Exit with appropriate code
        summary = results.get('summary', {})
        if 'error' in results:
            logger.error(f"Test execution failed: {results['error']}")
            sys.exit(1)
        elif not summary.get('beta_ready', False):
            logger.warning("Security assessment found critical issues - not ready for beta")
            sys.exit(2)  # Custom exit code for security issues
        else:
            logger.info("✅ Security assessment passed - ready for beta deployment")
            sys.exit(0)
            
    except KeyboardInterrupt:
        logger.info("Security testing interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())