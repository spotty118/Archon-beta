"""
Circuit Breaker Monitoring Service for Archon V2 Beta
====================================================

Comprehensive monitoring and alerting system for circuit breaker patterns across MCP services.
Provides real-time health insights, automatic recovery tracking, and performance analytics.

Features:
- Real-time circuit breaker state monitoring
- Service health trend analysis
- Automatic alerting for service degradation
- Performance metrics aggregation
- Historical failure pattern analysis
"""

import asyncio
import logging
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class ServiceHealth(Enum):
    """Service health status levels."""
    HEALTHY = "healthy"
    DEGRADED = "degraded" 
    CRITICAL = "critical"
    OFFLINE = "offline"


class AlertLevel(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


@dataclass
class CircuitBreakerSnapshot:
    """Circuit breaker state snapshot."""
    service_name: str
    state: str  # closed, open, half-open
    failure_count: int
    success_count: int
    last_failure_time: Optional[datetime]
    last_success_time: Optional[datetime]
    error_rate: float
    response_time_avg: float
    recovery_timeout: float
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ServiceAlert:
    """Service health alert."""
    service_name: str
    alert_level: AlertLevel
    message: str
    details: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
    alert_id: str = field(default_factory=lambda: f"alert_{int(time.time())}")


@dataclass
class PerformanceMetrics:
    """Aggregated performance metrics for a service."""
    service_name: str
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time: float
    min_response_time: float
    max_response_time: float
    error_rate: float
    availability: float
    last_updated: datetime = field(default_factory=datetime.now)


class CircuitBreakerMonitor:
    """
    Advanced circuit breaker monitoring service.
    
    Tracks circuit breaker states across all MCP services and provides:
    - Real-time health monitoring
    - Trend analysis and alerting
    - Performance metrics aggregation
    - Historical data analysis
    """
    
    def __init__(self, monitoring_interval: float = 30.0):
        self.monitoring_interval = monitoring_interval
        self.circuit_breaker_states: Dict[str, CircuitBreakerSnapshot] = {}
        self.performance_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self.alerts: List[ServiceAlert] = []
        self.alert_history: deque = deque(maxlen=1000)
        
        # Monitoring thresholds
        self.error_rate_warning = 0.05  # 5% error rate
        self.error_rate_critical = 0.15  # 15% error rate
        self.response_time_warning = 2.0  # 2 seconds
        self.response_time_critical = 5.0  # 5 seconds
        self.circuit_open_duration_warning = 60.0  # 1 minute
        self.circuit_open_duration_critical = 300.0  # 5 minutes
        
        # Background monitoring task
        self._monitoring_task: Optional[asyncio.Task] = None
        self._running = False
    
    async def start_monitoring(self):
        """Start the background monitoring task."""
        if self._running:
            logger.warning("Circuit breaker monitoring already running")
            return
        
        self._running = True
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())
        logger.info("✓ Circuit breaker monitoring started")
    
    async def stop_monitoring(self):
        """Stop the background monitoring task."""
        self._running = False
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
        logger.info("✓ Circuit breaker monitoring stopped")
    
    async def _monitoring_loop(self):
        """Main monitoring loop."""
        while self._running:
            try:
                await self._collect_metrics()
                await self._analyze_health_trends()
                await self._check_alert_conditions()
                await self._cleanup_old_data()
                
                await asyncio.sleep(self.monitoring_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in circuit breaker monitoring loop: {e}")
                await asyncio.sleep(5.0)  # Brief pause before retry
    
    async def _collect_metrics(self):
        """Collect current circuit breaker and performance metrics."""
        try:
            # Import here to avoid circular imports
            from .mcp_http_client import get_mcp_http_client
            
            mcp_client = get_mcp_http_client()
            metrics = mcp_client.get_mcp_metrics()
            
            # Update circuit breaker states
            for host, cb_state in metrics.get("circuit_breakers", {}).items():
                service_name = self._extract_service_name(host)
                
                # Calculate performance metrics
                mcp_request_types = metrics.get("mcp_request_types", {})
                service_metrics = self._aggregate_service_metrics(service_name, mcp_request_types)
                
                snapshot = CircuitBreakerSnapshot(
                    service_name=service_name,
                    state=cb_state.get("state", "unknown"),
                    failure_count=cb_state.get("failure_count", 0),
                    success_count=service_metrics.get("successful_requests", 0),
                    last_failure_time=self._parse_datetime(cb_state.get("last_failure")),
                    last_success_time=datetime.now() if service_metrics.get("successful_requests", 0) > 0 else None,
                    error_rate=service_metrics.get("error_rate", 0.0),
                    response_time_avg=service_metrics.get("avg_response_time", 0.0),
                    recovery_timeout=30.0,  # From MCPCircuitBreakerConfig
                )
                
                self.circuit_breaker_states[service_name] = snapshot
                self.performance_history[service_name].append(snapshot)
                
        except Exception as e:
            logger.error(f"Error collecting circuit breaker metrics: {e}")
    
    def _extract_service_name(self, host: str) -> str:
        """Extract service name from host URL."""
        if "8181" in host:
            return "api-service"
        elif "8052" in host:
            return "agents-service"
        elif "8051" in host:
            return "mcp-service"
        else:
            return f"unknown-service-{host}"
    
    def _aggregate_service_metrics(self, service_name: str, mcp_request_types: Dict) -> Dict[str, Any]:
        """Aggregate metrics for a specific service."""
        total_requests = 0
        successful_requests = 0
        total_response_time = 0.0
        response_times = []
        
        for request_type, metrics in mcp_request_types.items():
            if metrics:
                total_requests += metrics.get("total_requests", 0)
                successful_requests += metrics.get("successful_requests", 0)
                
                if metrics.get("avg_response_time"):
                    response_times.append(metrics["avg_response_time"])
                    total_response_time += metrics["avg_response_time"]
        
        error_rate = 0.0
        if total_requests > 0:
            error_rate = (total_requests - successful_requests) / total_requests
        
        avg_response_time = 0.0
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
        
        return {
            "total_requests": total_requests,
            "successful_requests": successful_requests,
            "failed_requests": total_requests - successful_requests,
            "error_rate": error_rate,
            "avg_response_time": avg_response_time,
        }
    
    def _parse_datetime(self, dt_str: Optional[str]) -> Optional[datetime]:
        """Parse datetime string safely."""
        if not dt_str:
            return None
        try:
            return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            return None
    
    async def _analyze_health_trends(self):
        """Analyze health trends and patterns."""
        for service_name, history in self.performance_history.items():
            if len(history) < 3:  # Need minimum data points
                continue
            
            recent_snapshots = list(history)[-10:]  # Last 10 snapshots
            
            # Trend analysis
            error_rates = [s.error_rate for s in recent_snapshots]
            response_times = [s.response_time_avg for s in recent_snapshots]
            
            # Check for degradation trends
            if len(error_rates) >= 5:
                recent_error_trend = sum(error_rates[-3:]) / 3 - sum(error_rates[-6:-3]) / 3
                recent_response_trend = sum(response_times[-3:]) / 3 - sum(response_times[-6:-3]) / 3
                
                # Alert on significant degradation trends
                if recent_error_trend > 0.02:  # 2% increase in error rate
                    await self._create_alert(
                        service_name,
                        AlertLevel.WARNING,
                        f"Increasing error rate trend detected: +{recent_error_trend:.1%}",
                        {"trend_type": "error_rate_increase", "trend_value": recent_error_trend}
                    )
                
                if recent_response_trend > 0.5:  # 500ms increase in response time
                    await self._create_alert(
                        service_name,
                        AlertLevel.WARNING,
                        f"Increasing response time trend detected: +{recent_response_trend:.1f}s",
                        {"trend_type": "response_time_increase", "trend_value": recent_response_trend}
                    )
    
    async def _check_alert_conditions(self):
        """Check for alert conditions and create alerts."""
        for service_name, snapshot in self.circuit_breaker_states.items():
            
            # Circuit breaker state alerts
            if snapshot.state == "open":
                duration = self._get_circuit_open_duration(snapshot)
                if duration > self.circuit_open_duration_critical:
                    await self._create_alert(
                        service_name,
                        AlertLevel.CRITICAL,
                        f"Circuit breaker has been open for {duration:.0f} seconds",
                        {"circuit_state": "open", "duration": duration}
                    )
                elif duration > self.circuit_open_duration_warning:
                    await self._create_alert(
                        service_name,
                        AlertLevel.WARNING,
                        f"Circuit breaker has been open for {duration:.0f} seconds",
                        {"circuit_state": "open", "duration": duration}
                    )
            
            # Error rate alerts
            if snapshot.error_rate > self.error_rate_critical:
                await self._create_alert(
                    service_name,
                    AlertLevel.CRITICAL,
                    f"Critical error rate: {snapshot.error_rate:.1%}",
                    {"error_rate": snapshot.error_rate, "threshold": self.error_rate_critical}
                )
            elif snapshot.error_rate > self.error_rate_warning:
                await self._create_alert(
                    service_name,
                    AlertLevel.WARNING,
                    f"High error rate: {snapshot.error_rate:.1%}",
                    {"error_rate": snapshot.error_rate, "threshold": self.error_rate_warning}
                )
            
            # Response time alerts
            if snapshot.response_time_avg > self.response_time_critical:
                await self._create_alert(
                    service_name,
                    AlertLevel.CRITICAL,
                    f"Critical response time: {snapshot.response_time_avg:.1f}s",
                    {"response_time": snapshot.response_time_avg, "threshold": self.response_time_critical}
                )
            elif snapshot.response_time_avg > self.response_time_warning:
                await self._create_alert(
                    service_name,
                    AlertLevel.WARNING,
                    f"High response time: {snapshot.response_time_avg:.1f}s",
                    {"response_time": snapshot.response_time_avg, "threshold": self.response_time_warning}
                )
    
    def _get_circuit_open_duration(self, snapshot: CircuitBreakerSnapshot) -> float:
        """Calculate how long a circuit breaker has been open."""
        if snapshot.last_failure_time:
            return (datetime.now() - snapshot.last_failure_time).total_seconds()
        return 0.0
    
    async def _create_alert(self, service_name: str, level: AlertLevel, message: str, details: Dict[str, Any]):
        """Create and store a new alert."""
        # Avoid duplicate alerts within short time window
        recent_alerts = [a for a in self.alerts if 
                        a.service_name == service_name and 
                        a.alert_level == level and
                        (datetime.now() - a.timestamp).total_seconds() < 300]  # 5 minutes
        
        if recent_alerts:
            return  # Skip duplicate alert
        
        alert = ServiceAlert(
            service_name=service_name,
            alert_level=level,
            message=message,
            details=details
        )
        
        self.alerts.append(alert)
        self.alert_history.append(alert)
        
        # Log alert
        log_level = {
            AlertLevel.INFO: logging.INFO,
            AlertLevel.WARNING: logging.WARNING,
            AlertLevel.CRITICAL: logging.ERROR,
            AlertLevel.EMERGENCY: logging.CRITICAL
        }.get(level, logging.INFO)
        
        logger.log(log_level, f"🚨 {service_name}: {message}")
    
    async def _cleanup_old_data(self):
        """Clean up old alerts and data."""
        # Remove alerts older than 1 hour
        cutoff_time = datetime.now() - timedelta(hours=1)
        self.alerts = [a for a in self.alerts if a.timestamp > cutoff_time]
    
    def get_service_health_summary(self) -> Dict[str, Any]:
        """Get overall service health summary."""
        summary = {
            "overall_status": ServiceHealth.HEALTHY.value,
            "services": {},
            "active_alerts": len(self.alerts),
            "monitoring_since": datetime.now().isoformat()
        }
        
        critical_services = 0
        degraded_services = 0
        
        for service_name, snapshot in self.circuit_breaker_states.items():
            service_health = self._determine_service_health(snapshot)
            
            summary["services"][service_name] = {
                "health": service_health.value,
                "circuit_state": snapshot.state,
                "error_rate": f"{snapshot.error_rate:.1%}",
                "avg_response_time": f"{snapshot.response_time_avg:.1f}s",
                "last_updated": snapshot.timestamp.isoformat()
            }
            
            if service_health == ServiceHealth.CRITICAL:
                critical_services += 1
            elif service_health == ServiceHealth.DEGRADED:
                degraded_services += 1
        
        # Determine overall status
        if critical_services > 0:
            summary["overall_status"] = ServiceHealth.CRITICAL.value
        elif degraded_services > 0:
            summary["overall_status"] = ServiceHealth.DEGRADED.value
        
        return summary
    
    def _determine_service_health(self, snapshot: CircuitBreakerSnapshot) -> ServiceHealth:
        """Determine health status for a service."""
        if snapshot.state == "open":
            duration = self._get_circuit_open_duration(snapshot)
            if duration > self.circuit_open_duration_critical:
                return ServiceHealth.CRITICAL
            else:
                return ServiceHealth.DEGRADED
        
        if snapshot.error_rate > self.error_rate_critical:
            return ServiceHealth.CRITICAL
        elif snapshot.error_rate > self.error_rate_warning:
            return ServiceHealth.DEGRADED
        
        if snapshot.response_time_avg > self.response_time_critical:
            return ServiceHealth.CRITICAL
        elif snapshot.response_time_avg > self.response_time_warning:
            return ServiceHealth.DEGRADED
        
        return ServiceHealth.HEALTHY
    
    def get_active_alerts(self) -> List[Dict[str, Any]]:
        """Get all active alerts."""
        return [
            {
                "alert_id": alert.alert_id,
                "service_name": alert.service_name,
                "level": alert.alert_level.value,
                "message": alert.message,
                "details": alert.details,
                "timestamp": alert.timestamp.isoformat()
            }
            for alert in self.alerts
        ]
    
    def get_performance_metrics(self, service_name: Optional[str] = None) -> Dict[str, Any]:
        """Get aggregated performance metrics."""
        if service_name:
            if service_name not in self.performance_history:
                return {"error": f"Service {service_name} not found"}
            
            history = list(self.performance_history[service_name])
            if not history:
                return {"error": f"No metrics available for {service_name}"}
            
            latest = history[-1]
            return {
                "service_name": service_name,
                "current_state": latest.state,
                "error_rate": latest.error_rate,
                "avg_response_time": latest.response_time_avg,
                "failure_count": latest.failure_count,
                "success_count": latest.success_count,
                "last_updated": latest.timestamp.isoformat(),
                "history_points": len(history)
            }
        else:
            # Return metrics for all services
            return {
                service: self.get_performance_metrics(service)
                for service in self.circuit_breaker_states.keys()
            }


# Global circuit breaker monitor instance
_circuit_breaker_monitor: Optional[CircuitBreakerMonitor] = None


def get_circuit_breaker_monitor() -> CircuitBreakerMonitor:
    """Get the global circuit breaker monitor instance."""
    global _circuit_breaker_monitor
    if _circuit_breaker_monitor is None:
        _circuit_breaker_monitor = CircuitBreakerMonitor()
    return _circuit_breaker_monitor


async def start_circuit_breaker_monitoring():
    """Start the global circuit breaker monitoring."""
    monitor = get_circuit_breaker_monitor()
    await monitor.start_monitoring()


async def stop_circuit_breaker_monitoring():
    """Stop the global circuit breaker monitoring."""
    global _circuit_breaker_monitor
    if _circuit_breaker_monitor:
        await _circuit_breaker_monitor.stop_monitoring()