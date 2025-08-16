"""
Production-Grade Load Testing Scenarios for Archon V2 Beta

Comprehensive test scenarios that simulate realistic production workloads:
- Enterprise user patterns with realistic think times
- Mixed API endpoint testing with proper load distribution
- Stress testing for peak traffic scenarios
- Endurance testing for memory leaks and stability
"""

import asyncio
import aiohttp
import time
import random
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import json

from load_test_suite import (
    LoadTestConfig, TestResult, LoadTestClient, 
    RealisticUserSimulator, SystemMonitor, LoadTestRunner
)


@dataclass
class ProductionScenarioConfig(LoadTestConfig):
    """Extended configuration for production scenarios"""
    # Advanced scenario parameters
    user_ramp_pattern: str = "linear"  # linear, exponential, step
    peak_hold_duration: int = 180      # seconds to hold peak load
    scenario_name: str = "production"
    
    # Realistic production parameters
    api_error_injection_rate: float = 0.02  # 2% error rate simulation
    network_delay_simulation: bool = True
    database_stress_testing: bool = True
    memory_leak_detection: bool = True
    
    # Enterprise-specific settings
    large_document_upload_rate: float = 0.1  # 10% of users upload large docs
    concurrent_project_operations: int = 5   # Simultaneous project operations
    mcp_tool_usage_rate: float = 0.15       # 15% of users use MCP tools


class EnterpriseUserSimulator(RealisticUserSimulator):
    """Advanced user simulation for production scenarios"""
    
    def __init__(self, config: ProductionScenarioConfig, client: LoadTestClient):
        super().__init__(config, client)
        self.config = config  # Type hint for extended config
    
    async def simulate_enterprise_knowledge_workflow(self, user_id: int) -> List[TestResult]:
        """Simulate enterprise knowledge management workflow"""
        results = []
        
        # 1. Browse knowledge base with search
        result = await self.client.make_request("GET", "/api/knowledge-items")
        results.append(result)
        await self._enterprise_think_time()
        
        # 2. Complex search with filters
        search_params = {
            "query": random.choice([
                "API documentation authentication",
                "deployment best practices",
                "security vulnerability assessment",
                "performance optimization strategies"
            ]),
            "source_type": random.choice(["documentation", "api_reference", None]),
            "tags": random.choice([["security"], ["performance"], None])
        }
        
        query_string = "&".join(f"{k}={v}" for k, v in search_params.items() if v)
        result = await self.client.make_request("GET", f"/api/knowledge-items/search?{query_string}")
        results.append(result)
        await self._enterprise_think_time()
        
        # 3. Large document upload (10% of users)
        if random.random() < self.config.large_document_upload_rate:
            large_doc_data = {
                "title": f"Enterprise Document {user_id}",
                "content": "x" * 50000,  # 50KB document
                "tags": ["enterprise", "large-doc", f"user-{user_id}"],
                "metadata": {
                    "department": random.choice(["Engineering", "Security", "Operations"]),
                    "classification": "internal",
                    "version": "1.0"
                }
            }
            result = await self.client.make_request("POST", "/api/knowledge-items", json=large_doc_data)
            results.append(result)
            await self._enterprise_think_time()
        
        # 4. Bulk operations (enterprise users often work with multiple items)
        for _ in range(random.randint(2, 5)):
            item_id = f"load-test-source-{random.randint(0, 9999):06d}"
            result = await self.client.make_request("GET", f"/api/knowledge-items/{item_id}")
            results.append(result)
            
            # Sometimes update or tag items
            if random.random() < 0.3:
                update_data = {
                    "tags": [f"reviewed-by-user-{user_id}", "enterprise-validated"]
                }
                result = await self.client.make_request("PUT", f"/api/knowledge-items/{item_id}", json=update_data)
                results.append(result)
        
        return results
    
    async def simulate_enterprise_project_workflow(self, user_id: int) -> List[TestResult]:
        """Simulate enterprise project management workflow"""
        results = []
        
        # 1. Dashboard overview
        result = await self.client.make_request("GET", "/api/projects")
        results.append(result)
        await self._enterprise_think_time()
        
        # 2. Project details with task management
        project_id = f"load-test-project-{random.randint(0, 99):04d}"
        result = await self.client.make_request("GET", f"/api/projects/{project_id}")
        results.append(result)
        
        # 3. Task operations (enterprise users manage multiple tasks)
        result = await self.client.make_request("GET", f"/api/projects/{project_id}/tasks")
        results.append(result)
        await self._enterprise_think_time()
        
        # 4. Create complex task with full metadata
        if random.random() < 0.2:  # 20% create new tasks
            complex_task = {
                "title": f"Enterprise Task from Load Test User {user_id}",
                "description": f"Complex enterprise task with detailed requirements and acceptance criteria. Created during load testing by user {user_id}.",
                "status": "todo",
                "priority": random.choice(["medium", "high", "critical"]),
                "assignee": f"enterprise-user-{user_id % 10}",
                "estimated_hours": random.randint(8, 40),
                "tags": ["enterprise", "load-test", "critical-path"],
                "metadata": {
                    "business_value": random.choice(["high", "medium", "critical"]),
                    "technical_complexity": random.choice(["medium", "high", "complex"]),
                    "dependencies": [f"task-{random.randint(1, 100)}" for _ in range(random.randint(0, 3))]
                }
            }
            result = await self.client.make_request("POST", f"/api/projects/{project_id}/tasks", json=complex_task)
            results.append(result)
        
        # 5. Task status updates (frequent in enterprise environments)
        for _ in range(random.randint(1, 3)):
            task_id = f"load-test-task-{random.randint(0, 999999):08d}"
            update_data = {
                "status": random.choice(["doing", "review", "done"]),
                "progress_notes": f"Updated by user {user_id} during load test"
            }
            result = await self.client.make_request("PUT", f"/api/projects/{project_id}/tasks/{task_id}", json=update_data)
            results.append(result)
        
        return results
    
    async def simulate_mcp_power_user_workflow(self, user_id: int) -> List[TestResult]:
        """Simulate power users leveraging MCP tools heavily"""
        results = []
        
        # 1. Check MCP service health
        result = await self.client.make_request("GET", "/api/mcp/health")
        results.append(result)
        await self._enterprise_think_time()
        
        # 2. Complex RAG queries (power users do research)
        complex_queries = [
            "authentication patterns OAuth2 PKCE implementation best practices",
            "database optimization PostgreSQL vector similarity search performance",
            "React component patterns accessibility WCAG compliance examples",
            "FastAPI async performance testing load balancing strategies",
            "Docker containerization security hardening enterprise deployment"
        ]
        
        for _ in range(random.randint(2, 4)):
            query = random.choice(complex_queries)
            rag_data = {
                "query": query,
                "match_count": random.randint(5, 10),
                "source_filters": {
                    "source_type": random.choice(["documentation", "api_reference", None])
                }
            }
            result = await self.client.make_request("POST", "/api/mcp/tools/perform_rag_query", json=rag_data)
            results.append(result)
            await self._enterprise_think_time()
        
        # 3. Code example searches
        if random.random() < 0.7:  # 70% of power users search code
            code_query = {
                "query": random.choice([
                    "React useState hook async data fetching",
                    "FastAPI dependency injection authentication",
                    "PostgreSQL vector search performance optimization",
                    "Docker multi-stage build Node.js Python"
                ]),
                "match_count": 5
            }
            result = await self.client.make_request("POST", "/api/mcp/tools/search_code_examples", json=code_query)
            results.append(result)
        
        return results
    
    async def simulate_settings_power_user(self, user_id: int) -> List[TestResult]:
        """Simulate enterprise admin managing settings"""
        results = []
        
        # 1. Settings overview
        result = await self.client.make_request("GET", "/api/settings")
        results.append(result)
        await self._enterprise_think_time()
        
        # 2. API key rotation (enterprise security practice)
        if random.random() < 0.1:  # 10% of admin users rotate keys
            settings_data = {
                "openai_api_key": f"sk-enterprise-key-{user_id}-{int(time.time())}",
                "security_mode": "enterprise",
                "audit_logging": True
            }
            result = await self.client.make_request("PUT", "/api/settings", json=settings_data)
            results.append(result)
        
        # 3. Feature flag management
        if random.random() < 0.15:  # 15% manage feature flags
            feature_data = {
                "projects_enabled": True,
                "mcp_integration": True,
                "advanced_search": True,
                "bulk_operations": True
            }
            result = await self.client.make_request("PUT", "/api/settings/features", json=feature_data)
            results.append(result)
        
        return results
    
    async def _enterprise_think_time(self):
        """Enterprise users have different think time patterns"""
        # Enterprise users often multitask, leading to longer think times
        think_time = random.uniform(
            self.config.think_time_min * 1.5,  # Longer minimum
            self.config.think_time_max * 2.0   # Longer maximum
        )
        await asyncio.sleep(think_time)


class ProductionLoadTestRunner(LoadTestRunner):
    """Enhanced load test runner for production scenarios"""
    
    def __init__(self, config: ProductionScenarioConfig):
        super().__init__(config)
        self.config = config  # Type hint for extended config
    
    async def run_production_scenario(self) -> dict:
        """Run comprehensive production scenario"""
        print(f"🚀 Starting production scenario: {self.config.scenario_name}")
        print(f"🎯 Pattern: {self.config.user_ramp_pattern}")
        print(f"⏱️  Peak hold: {self.config.peak_hold_duration}s")
        
        start_time = datetime.now()
        
        # Start system monitoring
        monitor_task = asyncio.create_task(self.monitor.start_monitoring())
        
        try:
            if self.config.user_ramp_pattern == "linear":
                await self._run_linear_ramp_scenario()
            elif self.config.user_ramp_pattern == "exponential":
                await self._run_exponential_ramp_scenario()
            elif self.config.user_ramp_pattern == "step":
                await self._run_step_ramp_scenario()
            else:
                await self._run_spike_scenario()
                
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
        report = self._generate_report(start_time, end_time)
        return report
    
    async def _run_linear_ramp_scenario(self):
        """Linear user ramp-up scenario"""
        user_tasks = []
        users_per_step = self.config.concurrent_users // 10  # 10 steps
        step_duration = self.config.ramp_up_seconds // 10
        
        for step in range(10):
            users_in_step = users_per_step * (step + 1)
            
            # Add new users for this step
            for user_id in range(len(user_tasks), users_in_step):
                task = asyncio.create_task(
                    self._simulate_enterprise_user_session(user_id, step * step_duration)
                )
                user_tasks.append(task)
            
            print(f"Step {step + 1}: {users_in_step} concurrent users")
            await asyncio.sleep(step_duration)
        
        # Hold peak load
        print(f"Holding peak load of {self.config.concurrent_users} users for {self.config.peak_hold_duration}s")
        await asyncio.sleep(self.config.peak_hold_duration)
        
        # Wait for all sessions to complete
        await asyncio.gather(*user_tasks, return_exceptions=True)
    
    async def _run_spike_scenario(self):
        """Sudden spike scenario"""
        print("🚀 Starting spike test: 0 → peak users in 30 seconds")
        
        user_tasks = []
        spike_duration = 30  # 30 second spike
        users_per_second = self.config.concurrent_users // spike_duration
        
        for second in range(spike_duration):
            # Add users rapidly
            for _ in range(users_per_second):
                user_id = len(user_tasks)
                task = asyncio.create_task(
                    self._simulate_enterprise_user_session(user_id, second)
                )
                user_tasks.append(task)
            
            await asyncio.sleep(1)
        
        # Hold peak briefly
        await asyncio.sleep(self.config.peak_hold_duration)
        await asyncio.gather(*user_tasks, return_exceptions=True)
    
    async def _simulate_enterprise_user_session(self, user_id: int, start_delay: float):
        """Enhanced user session simulation for enterprise scenarios"""
        await asyncio.sleep(start_delay)
        
        session_end_time = time.time() + (
            self.config.test_duration_seconds - start_delay
        )
        
        async with LoadTestClient(self.config) as client:
            simulator = EnterpriseUserSimulator(self.config, client)
            
            while time.time() < session_end_time:
                # Enterprise user behavior patterns
                behavior_weights = [
                    (simulator.simulate_enterprise_knowledge_workflow, 40),  # Primary activity
                    (simulator.simulate_enterprise_project_workflow, 30),   # Project management
                    (simulator.simulate_mcp_power_user_workflow, 20),       # Power user features
                    (simulator.simulate_settings_power_user, 10)            # Admin activities
                ]
                
                # Choose behavior based on weights
                behaviors, weights = zip(*behavior_weights)
                behavior = random.choices(behaviors, weights=weights, k=1)[0]
                
                try:
                    results = await behavior(user_id)
                    self.all_results.extend(results)
                    
                    # Enterprise users take longer breaks
                    if random.random() < 0.15:  # 15% chance of extended break
                        await asyncio.sleep(random.uniform(30, 120))
                        
                except Exception as e:
                    print(f"Enterprise user {user_id} session error: {e}")
                
                # Simulate network delays if enabled
                if self.config.network_delay_simulation:
                    await asyncio.sleep(random.uniform(0.1, 0.5))


# Production Scenario Definitions
PRODUCTION_SCENARIOS = {
    "enterprise_baseline": ProductionScenarioConfig(
        scenario_name="Enterprise Baseline",
        concurrent_users=25,
        test_duration_seconds=600,  # 10 minutes
        ramp_up_seconds=120,        # 2 minutes
        user_ramp_pattern="linear",
        peak_hold_duration=300,     # 5 minutes
        max_response_time=2.0,
        max_error_rate=0.02,
        large_document_upload_rate=0.05,
        mcp_tool_usage_rate=0.10
    ),
    
    "enterprise_peak": ProductionScenarioConfig(
        scenario_name="Enterprise Peak Load",
        concurrent_users=100,
        test_duration_seconds=900,  # 15 minutes
        ramp_up_seconds=180,        # 3 minutes
        user_ramp_pattern="exponential",
        peak_hold_duration=300,     # 5 minutes
        max_response_time=3.0,      # More lenient for peak
        max_error_rate=0.05,
        large_document_upload_rate=0.15,
        mcp_tool_usage_rate=0.20
    ),
    
    "enterprise_spike": ProductionScenarioConfig(
        scenario_name="Enterprise Traffic Spike",
        concurrent_users=200,
        test_duration_seconds=300,  # 5 minutes
        ramp_up_seconds=30,         # 30 seconds
        user_ramp_pattern="spike",
        peak_hold_duration=120,     # 2 minutes
        max_response_time=5.0,      # Very lenient for spike
        max_error_rate=0.10,
        large_document_upload_rate=0.20,
        mcp_tool_usage_rate=0.25
    ),
    
    "enterprise_endurance": ProductionScenarioConfig(
        scenario_name="Enterprise Endurance Test",
        concurrent_users=50,
        test_duration_seconds=3600, # 1 hour
        ramp_up_seconds=300,        # 5 minutes
        user_ramp_pattern="step",
        peak_hold_duration=2700,    # 45 minutes
        max_response_time=2.5,
        max_error_rate=0.03,
        memory_leak_detection=True,
        large_document_upload_rate=0.10,
        mcp_tool_usage_rate=0.15
    )
}


async def run_production_scenario(scenario_name: str = "enterprise_baseline"):
    """Run a specific production scenario"""
    if scenario_name not in PRODUCTION_SCENARIOS:
        raise ValueError(f"Unknown scenario: {scenario_name}. Available: {list(PRODUCTION_SCENARIOS.keys())}")
    
    config = PRODUCTION_SCENARIOS[scenario_name]
    runner = ProductionLoadTestRunner(config)
    
    print(f"🎯 Running production scenario: {scenario_name}")
    print(f"📊 Configuration: {config.concurrent_users} users, {config.test_duration_seconds}s duration")
    
    report = await runner.run_production_scenario()
    
    # Save detailed report
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = f"production_load_test_{scenario_name}_{timestamp}.json"
    
    with open(report_file, 'w') as f:
        # Convert datetime objects for JSON serialization
        report_copy = report.copy()
        if hasattr(report_copy, 'start_time'):
            report_copy['start_time'] = report_copy['start_time'].isoformat()
        if hasattr(report_copy, 'end_time'):
            report_copy['end_time'] = report_copy['end_time'].isoformat()
        
        json.dump(report_copy, f, indent=2, default=str)
    
    print(f"📊 Production load test report saved: {report_file}")
    return report


if __name__ == "__main__":
    import sys
    
    scenario = sys.argv[1] if len(sys.argv) > 1 else "enterprise_baseline"
    
    print(f"🚀 Starting Archon V2 Production Load Test")
    print(f"🎯 Scenario: {scenario}")
    
    report = asyncio.run(run_production_scenario(scenario))
    
    # Exit with appropriate code
    exit_code = 0 if hasattr(report, 'pass_fail_status') and 'PASS' in str(report.pass_fail_status) else 1
    sys.exit(exit_code)