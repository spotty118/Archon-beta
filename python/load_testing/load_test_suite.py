"""
Comprehensive Load Testing Suite for Archon V2 Beta

Tests system performance under realistic production workloads with:
- Concurrent user simulation
- Realistic data volumes
- API endpoint stress testing
- Database performance under load
- Memory and resource monitoring
"""

import asyncio
import aiohttp
import time
import json
import statistics
import psutil
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class LoadTestConfig:
    """Configuration for load testing scenarios"""
    base_url: str = "http://localhost:8181"
    concurrent_users: int = 50
    test_duration_seconds: int = 300  # 5 minutes
    ramp_up_seconds: int = 60  # 1 minute ramp-up
    think_time_min: float = 1.0  # Min wait between requests
    think_time_max: float = 5.0  # Max wait between requests
    request_timeout: float = 30.0
    
    # Realistic data volumes
    knowledge_items_count: int = 1000
    documents_per_item: int = 10
    concurrent_crawls: int = 5
    max_document_size: int = 50000  # 50KB per document
    
    # Performance thresholds
    max_response_time: float = 2.0  # 2 seconds
    max_error_rate: float = 0.05  # 5% error rate
    max_memory_usage_mb: int = 1024  # 1GB memory limit


@dataclass
class TestResult:
    """Results from a single request"""
    endpoint: str
    method: str
    status_code: int
    response_time: float
    success: bool
    error_message: Optional[str] = None
    timestamp: float = 0.0


@dataclass
class LoadTestReport:
    """Comprehensive load test report"""
    config: LoadTestConfig
    start_time: datetime
    end_time: datetime
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time: float
    p95_response_time: float
    p99_response_time: float
    requests_per_second: float
    error_rate: float
    peak_memory_usage_mb: float
    peak_cpu_usage_percent: float
    endpoint_stats: Dict[str, Dict[str, Any]]
    errors: List[str]
    pass_fail_status: str


class SystemMonitor:
    """Monitors system resources during load testing"""
    
    def __init__(self):
        self.cpu_readings: List[float] = []
        self.memory_readings: List[float] = []
        self.monitoring = False
    
    async def start_monitoring(self):
        """Start system resource monitoring"""
        self.monitoring = True
        self.cpu_readings.clear()
        self.memory_readings.clear()
        
        while self.monitoring:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory_mb = psutil.virtual_memory().used / 1024 / 1024
            
            self.cpu_readings.append(cpu_percent)
            self.memory_readings.append(memory_mb)
            
            await asyncio.sleep(1)
    
    def stop_monitoring(self):
        """Stop system resource monitoring"""
        self.monitoring = False
    
    def get_peak_usage(self) -> tuple[float, float]:
        """Get peak CPU and memory usage"""
        peak_cpu = max(self.cpu_readings) if self.cpu_readings else 0
        peak_memory = max(self.memory_readings) if self.memory_readings else 0
        return peak_cpu, peak_memory


class LoadTestClient:
    """HTTP client for load testing with realistic user behavior"""
    
    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None
        self.results: List[TestResult] = []
        
    async def __aenter__(self):
        timeout = aiohttp.ClientTimeout(total=self.config.request_timeout)
        connector = aiohttp.TCPConnector(limit=200, limit_per_host=50)
        self.session = aiohttp.ClientSession(
            timeout=timeout,
            connector=connector
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def make_request(
        self, 
        method: str, 
        endpoint: str, 
        **kwargs
    ) -> TestResult:
        """Make a single HTTP request and record metrics"""
        start_time = time.time()
        url = f"{self.config.base_url}{endpoint}"
        
        try:
            async with self.session.request(method, url, **kwargs) as response:
                # Read response body to simulate real usage
                await response.text()
                
                response_time = time.time() - start_time
                success = response.status < 400
                
                result = TestResult(
                    endpoint=endpoint,
                    method=method,
                    status_code=response.status,
                    response_time=response_time,
                    success=success,
                    timestamp=start_time
                )
                
                self.results.append(result)
                return result
                
        except Exception as e:
            response_time = time.time() - start_time
            result = TestResult(
                endpoint=endpoint,
                method=method,
                status_code=0,
                response_time=response_time,
                success=False,
                error_message=str(e),
                timestamp=start_time
            )
            
            self.results.append(result)
            return result


class RealisticUserSimulator:
    """Simulates realistic user behavior patterns"""
    
    def __init__(self, config: LoadTestConfig, client: LoadTestClient):
        self.config = config
        self.client = client
        
    async def simulate_knowledge_base_user(self, user_id: int) -> List[TestResult]:
        """Simulate a user working with knowledge base"""
        results = []
        
        # User workflow: Browse → Search → Add → Edit → Delete
        
        # 1. Load knowledge base page
        result = await self.client.make_request("GET", "/api/knowledge-items")
        results.append(result)
        await self._think_time()
        
        # 2. Search for items (common user action)
        search_terms = ["documentation", "api", "guide", "tutorial", "example"]
        search_term = random.choice(search_terms)
        result = await self.client.make_request(
            "GET", 
            f"/api/knowledge-items?search={search_term}"
        )
        results.append(result)
        await self._think_time()
        
        # 3. View specific knowledge item details
        if random.random() < 0.7:  # 70% chance to view details
            result = await self.client.make_request(
                "GET", 
                f"/api/knowledge-items/test-item-{user_id % 100}"
            )
            results.append(result)
            await self._think_time()
        
        # 4. Add new knowledge item (less frequent action)
        if random.random() < 0.2:  # 20% chance to add new item
            new_item_data = {
                "title": f"Test Item from User {user_id}",
                "url": f"https://example.com/docs/{user_id}",
                "description": f"Test documentation added by user {user_id}",
                "knowledge_type": "documentation",
                "tags": ["test", "load-testing"],
                "update_frequency": 7
            }
            result = await self.client.make_request(
                "POST", 
                "/api/knowledge-items",
                json=new_item_data
            )
            results.append(result)
            await self._think_time()
        
        # 5. Update existing item (occasional action)
        if random.random() < 0.1:  # 10% chance to update
            update_data = {
                "title": f"Updated Test Item {user_id}",
                "description": "Updated description for load testing"
            }
            result = await self.client.make_request(
                "PUT",
                f"/api/knowledge-items/test-item-{user_id % 100}",
                json=update_data
            )
            results.append(result)
            await self._think_time()
        
        return results
    
    async def simulate_settings_user(self, user_id: int) -> List[TestResult]:
        """Simulate user managing settings"""
        results = []
        
        # 1. Load settings page
        result = await self.client.make_request("GET", "/api/settings")
        results.append(result)
        await self._think_time()
        
        # 2. Update API keys (common admin action)
        if random.random() < 0.3:  # 30% chance to update settings
            settings_data = {
                "openai_api_key": f"sk-test-key-{user_id}",
                "projects_enabled": random.choice([True, False]),
                "chunk_size": random.choice([500, 1000, 1500, 2000])
            }
            result = await self.client.make_request(
                "PUT",
                "/api/settings",
                json=settings_data
            )
            results.append(result)
            await self._think_time()
        
        return results
    
    async def simulate_mcp_user(self, user_id: int) -> List[TestResult]:
        """Simulate user interacting with MCP services"""
        results = []
        
        # 1. Check MCP status
        result = await self.client.make_request("GET", "/api/mcp/status")
        results.append(result)
        await self._think_time()
        
        # 2. List available tools
        result = await self.client.make_request("GET", "/api/mcp/tools")
        results.append(result)
        await self._think_time()
        
        # 3. Execute a tool (occasional action)
        if random.random() < 0.1:  # 10% chance to execute tool
            tool_data = {
                "tool_name": "perform_rag_query",
                "arguments": {
                    "query": f"test query from user {user_id}",
                    "match_count": 5
                }
            }
            result = await self.client.make_request(
                "POST",
                "/api/mcp/tools/perform_rag_query",
                json=tool_data
            )
            results.append(result)
            await self._think_time()
        
        return results
    
    async def simulate_projects_user(self, user_id: int) -> List[TestResult]:
        """Simulate user managing projects and tasks"""
        results = []
        
        # 1. Load projects page
        result = await self.client.make_request("GET", "/api/projects")
        results.append(result)
        await self._think_time()
        
        # 2. View specific project
        if random.random() < 0.6:  # 60% chance to view project
            result = await self.client.make_request(
                "GET", 
                f"/api/projects/test-project-{user_id % 10}"
            )
            results.append(result)
            await self._think_time()
            
            # 3. Load project tasks
            result = await self.client.make_request(
                "GET",
                f"/api/projects/test-project-{user_id % 10}/tasks"
            )
            results.append(result)
            await self._think_time()
        
        # 4. Create new task (less frequent)
        if random.random() < 0.15:  # 15% chance to create task
            task_data = {
                "title": f"Load Test Task {user_id}",
                "description": f"Task created during load testing by user {user_id}",
                "status": "todo",
                "priority": random.choice(["low", "medium", "high"]),
                "assignee": "load-test-user"
            }
            result = await self.client.make_request(
                "POST",
                f"/api/projects/test-project-{user_id % 10}/tasks",
                json=task_data
            )
            results.append(result)
            await self._think_time()
        
        return results
    
    async def _think_time(self):
        """Simulate realistic user think time between actions"""
        think_time = random.uniform(
            self.config.think_time_min,
            self.config.think_time_max
        )
        await asyncio.sleep(think_time)


class LoadTestRunner:
    """Main load test execution engine"""
    
    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.monitor = SystemMonitor()
        self.all_results: List[TestResult] = []
        
    async def run_load_test(self) -> LoadTestReport:
        """Execute comprehensive load test"""
        logger.info(f"Starting load test with {self.config.concurrent_users} users")
        logger.info(f"Test duration: {self.config.test_duration_seconds}s")
        logger.info(f"Ramp-up time: {self.config.ramp_up_seconds}s")
        
        start_time = datetime.now()
        
        # Start system monitoring
        monitor_task = asyncio.create_task(self.monitor.start_monitoring())
        
        try:
            # Create user simulation tasks
            user_tasks = []
            
            # Gradual ramp-up of users
            ramp_up_delay = self.config.ramp_up_seconds / self.config.concurrent_users
            
            for user_id in range(self.config.concurrent_users):
                # Stagger user starts for realistic ramp-up
                start_delay = user_id * ramp_up_delay
                task = asyncio.create_task(
                    self._simulate_user_session(user_id, start_delay)
                )
                user_tasks.append(task)
            
            # Wait for all user sessions to complete
            await asyncio.gather(*user_tasks, return_exceptions=True)
            
        finally:
            # Stop monitoring
            self.monitor.stop_monitoring()
            monitor_task.cancel()
            
            try:
                await monitor_task
            except asyncio.CancelledError:
                pass
        
        end_time = datetime.now()
        
        # Generate comprehensive report
        return self._generate_report(start_time, end_time)
    
    async def _simulate_user_session(self, user_id: int, start_delay: float):
        """Simulate a complete user session"""
        # Wait for ramp-up delay
        await asyncio.sleep(start_delay)
        
        session_end_time = time.time() + (
            self.config.test_duration_seconds - start_delay
        )
        
        async with LoadTestClient(self.config) as client:
            simulator = RealisticUserSimulator(self.config, client)
            
            while time.time() < session_end_time:
                # Randomly choose user behavior pattern
                behavior = random.choices(
                    [
                        simulator.simulate_knowledge_base_user,
                        simulator.simulate_settings_user,
                        simulator.simulate_mcp_user,
                        simulator.simulate_projects_user
                    ],
                    weights=[60, 15, 15, 10],  # Knowledge base is most common
                    k=1
                )[0]
                
                try:
                    results = await behavior(user_id)
                    self.all_results.extend(results)
                except Exception as e:
                    logger.error(f"User {user_id} session error: {e}")
                
                # Random session break (user idle time)
                if random.random() < 0.1:  # 10% chance of longer break
                    await asyncio.sleep(random.uniform(10, 30))
    
    def _generate_report(self, start_time: datetime, end_time: datetime) -> LoadTestReport:
        """Generate comprehensive load test report"""
        if not self.all_results:
            logger.warning("No results to analyze")
            return self._empty_report(start_time, end_time)
        
        # Basic metrics
        total_requests = len(self.all_results)
        successful_requests = sum(1 for r in self.all_results if r.success)
        failed_requests = total_requests - successful_requests
        
        response_times = [r.response_time for r in self.all_results]
        avg_response_time = statistics.mean(response_times)
        p95_response_time = statistics.quantiles(response_times, n=20)[18] if len(response_times) > 1 else 0
        p99_response_time = statistics.quantiles(response_times, n=100)[98] if len(response_times) > 1 else 0
        
        duration_seconds = (end_time - start_time).total_seconds()
        requests_per_second = total_requests / duration_seconds if duration_seconds > 0 else 0
        error_rate = failed_requests / total_requests if total_requests > 0 else 0
        
        # System resource usage
        peak_cpu, peak_memory = self.monitor.get_peak_usage()
        
        # Endpoint statistics
        endpoint_stats = self._calculate_endpoint_stats()
        
        # Error analysis
        errors = [r.error_message for r in self.all_results if r.error_message]
        unique_errors = list(set(errors))
        
        # Pass/fail determination
        pass_fail_status = self._determine_pass_fail(
            avg_response_time, error_rate, peak_memory
        )
        
        return LoadTestReport(
            config=self.config,
            start_time=start_time,
            end_time=end_time,
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            avg_response_time=avg_response_time,
            p95_response_time=p95_response_time,
            p99_response_time=p99_response_time,
            requests_per_second=requests_per_second,
            error_rate=error_rate,
            peak_memory_usage_mb=peak_memory,
            peak_cpu_usage_percent=peak_cpu,
            endpoint_stats=endpoint_stats,
            errors=unique_errors,
            pass_fail_status=pass_fail_status
        )
    
    def _calculate_endpoint_stats(self) -> Dict[str, Dict[str, Any]]:
        """Calculate per-endpoint performance statistics"""
        endpoint_results = {}
        
        for result in self.all_results:
            key = f"{result.method} {result.endpoint}"
            if key not in endpoint_results:
                endpoint_results[key] = []
            endpoint_results[key].append(result)
        
        stats = {}
        for endpoint, results in endpoint_results.items():
            response_times = [r.response_time for r in results]
            success_count = sum(1 for r in results if r.success)
            
            stats[endpoint] = {
                "total_requests": len(results),
                "successful_requests": success_count,
                "error_rate": (len(results) - success_count) / len(results),
                "avg_response_time": statistics.mean(response_times),
                "min_response_time": min(response_times),
                "max_response_time": max(response_times),
                "p95_response_time": statistics.quantiles(response_times, n=20)[18] if len(response_times) > 1 else 0
            }
        
        return stats
    
    def _determine_pass_fail(
        self, 
        avg_response_time: float, 
        error_rate: float, 
        peak_memory_mb: float
    ) -> str:
        """Determine if load test passed or failed based on thresholds"""
        failures = []
        
        if avg_response_time > self.config.max_response_time:
            failures.append(f"Average response time {avg_response_time:.2f}s exceeds {self.config.max_response_time}s")
        
        if error_rate > self.config.max_error_rate:
            failures.append(f"Error rate {error_rate:.2%} exceeds {self.config.max_error_rate:.2%}")
        
        if peak_memory_mb > self.config.max_memory_usage_mb:
            failures.append(f"Peak memory {peak_memory_mb:.1f}MB exceeds {self.config.max_memory_usage_mb}MB")
        
        return "PASS" if not failures else f"FAIL: {'; '.join(failures)}"
    
    def _empty_report(self, start_time: datetime, end_time: datetime) -> LoadTestReport:
        """Generate empty report when no results available"""
        return LoadTestReport(
            config=self.config,
            start_time=start_time,
            end_time=end_time,
            total_requests=0,
            successful_requests=0,
            failed_requests=0,
            avg_response_time=0.0,
            p95_response_time=0.0,
            p99_response_time=0.0,
            requests_per_second=0.0,
            error_rate=0.0,
            peak_memory_usage_mb=0.0,
            peak_cpu_usage_percent=0.0,
            endpoint_stats={},
            errors=[],
            pass_fail_status="FAIL: No requests completed"
        )


class LoadTestReporter:
    """Generate comprehensive load test reports"""
    
    @staticmethod
    def print_console_report(report: LoadTestReport):
        """Print detailed console report"""
        print("\n" + "="*80)
        print("🚀 ARCHON V2 BETA LOAD TEST REPORT")
        print("="*80)
        
        print(f"\n📊 TEST CONFIGURATION:")
        print(f"   Concurrent Users: {report.config.concurrent_users}")
        print(f"   Test Duration: {report.config.test_duration_seconds}s")
        print(f"   Ramp-up Time: {report.config.ramp_up_seconds}s")
        print(f"   Base URL: {report.config.base_url}")
        
        print(f"\n⏱️  TEST EXECUTION:")
        print(f"   Start Time: {report.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"   End Time: {report.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"   Duration: {(report.end_time - report.start_time).total_seconds():.1f}s")
        
        print(f"\n📈 PERFORMANCE METRICS:")
        print(f"   Total Requests: {report.total_requests:,}")
        print(f"   Successful: {report.successful_requests:,} ({report.successful_requests/report.total_requests*100:.1f}%)")
        print(f"   Failed: {report.failed_requests:,} ({report.error_rate*100:.2f}%)")
        print(f"   Requests/sec: {report.requests_per_second:.2f}")
        
        print(f"\n⚡ RESPONSE TIMES:")
        print(f"   Average: {report.avg_response_time*1000:.1f}ms")
        print(f"   95th percentile: {report.p95_response_time*1000:.1f}ms")
        print(f"   99th percentile: {report.p99_response_time*1000:.1f}ms")
        
        print(f"\n💻 SYSTEM RESOURCES:")
        print(f"   Peak CPU: {report.peak_cpu_usage_percent:.1f}%")
        print(f"   Peak Memory: {report.peak_memory_usage_mb:.1f}MB")
        
        print(f"\n🎯 ENDPOINT PERFORMANCE:")
        for endpoint, stats in sorted(report.endpoint_stats.items()):
            print(f"   {endpoint}:")
            print(f"     Requests: {stats['total_requests']:,} | "
                  f"Errors: {stats['error_rate']*100:.1f}% | "
                  f"Avg: {stats['avg_response_time']*1000:.1f}ms | "
                  f"P95: {stats['p95_response_time']*1000:.1f}ms")
        
        if report.errors:
            print(f"\n❌ UNIQUE ERRORS ({len(report.errors)}):")
            for i, error in enumerate(report.errors[:10], 1):
                print(f"   {i}. {error}")
            if len(report.errors) > 10:
                print(f"   ... and {len(report.errors) - 10} more")
        
        print(f"\n🏁 RESULT: {report.pass_fail_status}")
        print("="*80)
    
    @staticmethod
    def save_json_report(report: LoadTestReport, filename: str):
        """Save detailed JSON report"""
        report_data = asdict(report)
        
        # Convert datetime objects to ISO strings
        report_data['start_time'] = report.start_time.isoformat()
        report_data['end_time'] = report.end_time.isoformat()
        
        with open(filename, 'w') as f:
            json.dump(report_data, f, indent=2, default=str)
        
        print(f"\n💾 Detailed report saved to: {filename}")


# Predefined test scenarios
LOAD_TEST_SCENARIOS = {
    "light": LoadTestConfig(
        concurrent_users=10,
        test_duration_seconds=120,
        ramp_up_seconds=30
    ),
    
    "moderate": LoadTestConfig(
        concurrent_users=50,
        test_duration_seconds=300,
        ramp_up_seconds=60
    ),
    
    "heavy": LoadTestConfig(
        concurrent_users=100,
        test_duration_seconds=600,
        ramp_up_seconds=120
    ),
    
    "stress": LoadTestConfig(
        concurrent_users=200,
        test_duration_seconds=300,
        ramp_up_seconds=60,
        max_response_time=5.0,  # More lenient for stress test
        max_error_rate=0.10
    ),
    
    "spike": LoadTestConfig(
        concurrent_users=500,
        test_duration_seconds=180,
        ramp_up_seconds=30,  # Quick ramp-up for spike test
        max_response_time=10.0,
        max_error_rate=0.20
    )
}


async def main():
    """Main entry point for load testing"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Archon V2 Load Testing Suite")
    parser.add_argument(
        "--scenario", 
        choices=list(LOAD_TEST_SCENARIOS.keys()),
        default="moderate",
        help="Load test scenario to run"
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:8181",
        help="Base URL for Archon backend"
    )
    parser.add_argument(
        "--output",
        default="load_test_report.json",
        help="Output file for detailed JSON report"
    )
    
    args = parser.parse_args()
    
    # Get test configuration
    config = LOAD_TEST_SCENARIOS[args.scenario]
    config.base_url = args.base_url
    
    print(f"🚀 Starting {args.scenario} load test scenario...")
    print(f"🎯 Target: {config.base_url}")
    
    # Run load test
    runner = LoadTestRunner(config)
    report = await runner.run_load_test()
    
    # Generate reports
    LoadTestReporter.print_console_report(report)
    LoadTestReporter.save_json_report(report, args.output)
    
    # Exit with appropriate code
    exit_code = 0 if report.pass_fail_status.startswith("PASS") else 1
    return exit_code


if __name__ == "__main__":
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)