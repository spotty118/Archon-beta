"""
Monitoring API Routes for Archon V2 Beta
========================================

API endpoints for accessing circuit breaker monitoring, performance metrics,
and system health information.

Endpoints:
- GET /api/monitoring/circuit-breakers - Circuit breaker states and health
- GET /api/monitoring/alerts - Active alerts and alert history
- GET /api/monitoring/performance - Performance metrics by service
- GET /api/monitoring/health - Overall system health summary
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..services.circuit_breaker_monitor import get_circuit_breaker_monitor
from ..services.mcp_http_client import get_mcp_http_client

logger = logging.getLogger(__name__)

# Create the monitoring router
monitoring_router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


class HealthSummaryResponse(BaseModel):
    """Response model for health summary."""
    overall_status: str
    services: Dict[str, Any]
    active_alerts: int
    monitoring_since: str


class AlertResponse(BaseModel):
    """Response model for alerts."""
    alert_id: str
    service_name: str
    level: str
    message: str
    details: Dict[str, Any]
    timestamp: str


class PerformanceMetricsResponse(BaseModel):
    """Response model for performance metrics."""
    service_name: str
    current_state: str
    error_rate: float
    avg_response_time: float
    failure_count: int
    success_count: int
    last_updated: str
    history_points: int


@monitoring_router.get("/circuit-breakers", response_model=Dict[str, Any])
async def get_circuit_breaker_status():
    """
    Get current circuit breaker states and health information.
    
    Returns detailed information about all circuit breakers including:
    - Current state (open/closed/half-open)
    - Failure and success counts
    - Error rates and response times
    - Health status and trends
    """
    try:
        monitor = get_circuit_breaker_monitor()
        
        # Get circuit breaker states
        cb_states = {}
        for service_name, snapshot in monitor.circuit_breaker_states.items():
            cb_states[service_name] = {
                "state": snapshot.state,
                "failure_count": snapshot.failure_count,
                "success_count": snapshot.success_count,
                "error_rate": snapshot.error_rate,
                "avg_response_time": snapshot.response_time_avg,
                "last_failure": snapshot.last_failure_time.isoformat() if snapshot.last_failure_time else None,
                "last_success": snapshot.last_success_time.isoformat() if snapshot.last_success_time else None,
                "timestamp": snapshot.timestamp.isoformat()
            }
        
        # Get MCP HTTP client metrics for additional context
        try:
            mcp_client = get_mcp_http_client()
            mcp_metrics = mcp_client.get_mcp_metrics()
        except Exception as e:
            logger.warning(f"Could not fetch MCP metrics: {e}")
            mcp_metrics = {}
        
        return {
            "success": True,
            "circuit_breakers": cb_states,
            "mcp_metrics": mcp_metrics,
            "total_services": len(cb_states),
            "monitoring_active": True
        }
        
    except Exception as e:
        logger.error(f"Error getting circuit breaker status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get circuit breaker status: {str(e)}")


@monitoring_router.get("/alerts", response_model=Dict[str, Any])
async def get_monitoring_alerts(
    service_name: Optional[str] = Query(None, description="Filter alerts by service name"),
    level: Optional[str] = Query(None, description="Filter alerts by level (info, warning, critical, emergency)"),
    limit: int = Query(50, ge=1, le=1000, description="Maximum number of alerts to return")
):
    """
    Get active monitoring alerts and alert history.
    
    Returns current alerts with optional filtering by service name and alert level.
    Includes alert details, timestamps, and severity information.
    """
    try:
        monitor = get_circuit_breaker_monitor()
        alerts = monitor.get_active_alerts()
        
        # Apply filters
        if service_name:
            alerts = [a for a in alerts if a["service_name"] == service_name]
        
        if level:
            alerts = [a for a in alerts if a["level"] == level.lower()]
        
        # Apply limit
        alerts = alerts[:limit]
        
        # Get alert statistics
        alert_stats = {
            "total_active": len(monitor.alerts),
            "by_level": {},
            "by_service": {}
        }
        
        for alert in monitor.alerts:
            # Count by level
            level_key = alert.alert_level.value
            alert_stats["by_level"][level_key] = alert_stats["by_level"].get(level_key, 0) + 1
            
            # Count by service
            service_key = alert.service_name
            alert_stats["by_service"][service_key] = alert_stats["by_service"].get(service_key, 0) + 1
        
        return {
            "success": True,
            "alerts": alerts,
            "statistics": alert_stats,
            "filters_applied": {
                "service_name": service_name,
                "level": level,
                "limit": limit
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting monitoring alerts: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get alerts: {str(e)}")


@monitoring_router.get("/performance", response_model=Dict[str, Any])
async def get_performance_metrics(
    service_name: Optional[str] = Query(None, description="Get metrics for specific service"),
    include_history: bool = Query(False, description="Include historical performance data")
):
    """
    Get performance metrics for MCP services.
    
    Returns detailed performance information including:
    - Request counts and success rates
    - Response time statistics
    - Error rates and failure patterns
    - Circuit breaker effectiveness
    """
    try:
        monitor = get_circuit_breaker_monitor()
        
        if service_name:
            # Get metrics for specific service
            metrics = monitor.get_performance_metrics(service_name)
            
            # Add historical data if requested
            if include_history and service_name in monitor.performance_history:
                history = list(monitor.performance_history[service_name])
                metrics["history"] = [
                    {
                        "timestamp": snap.timestamp.isoformat(),
                        "state": snap.state,
                        "error_rate": snap.error_rate,
                        "response_time": snap.response_time_avg,
                        "failure_count": snap.failure_count
                    }
                    for snap in history[-20:]  # Last 20 data points
                ]
        else:
            # Get metrics for all services
            metrics = monitor.get_performance_metrics()
            
            # Add summary statistics
            all_services = list(monitor.circuit_breaker_states.keys())
            healthy_services = sum(1 for s in all_services 
                                 if monitor._determine_service_health(monitor.circuit_breaker_states[s]).value == "healthy")
            
            metrics["summary"] = {
                "total_services": len(all_services),
                "healthy_services": healthy_services,
                "degraded_services": len(all_services) - healthy_services,
                "monitoring_interval": monitor.monitoring_interval
            }
        
        return {
            "success": True,
            "metrics": metrics,
            "timestamp": monitor.circuit_breaker_states.get(service_name or list(monitor.circuit_breaker_states.keys())[0] if monitor.circuit_breaker_states else "unknown", 
                                                         type('obj', (object,), {'timestamp': 'unknown'})).timestamp.isoformat() if monitor.circuit_breaker_states else "unknown"
        }
        
    except Exception as e:
        logger.error(f"Error getting performance metrics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get performance metrics: {str(e)}")


@monitoring_router.get("/health", response_model=HealthSummaryResponse)
async def get_system_health_summary():
    """
    Get overall system health summary.
    
    Returns high-level health status for all services including:
    - Overall system status
    - Individual service health states
    - Active alert counts
    - Service availability metrics
    """
    try:
        monitor = get_circuit_breaker_monitor()
        health_summary = monitor.get_service_health_summary()
        
        return HealthSummaryResponse(**health_summary)
        
    except Exception as e:
        logger.error(f"Error getting system health summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get health summary: {str(e)}")


@monitoring_router.get("/mcp-metrics", response_model=Dict[str, Any])
async def get_mcp_detailed_metrics():
    """
    Get detailed MCP HTTP client metrics.
    
    Returns comprehensive metrics from the MCP HTTP client including:
    - Connection pool statistics
    - Request type performance breakdown
    - Circuit breaker trigger events
    - Service endpoint configuration
    """
    try:
        mcp_client = get_mcp_http_client()
        detailed_metrics = mcp_client.get_mcp_metrics()
        
        # Enhance with additional context
        enhanced_metrics = {
            "success": True,
            "mcp_client_metrics": detailed_metrics,
            "collection_timestamp": "real-time",
            "client_status": "active" if detailed_metrics else "inactive"
        }
        
        # Add connection pool health assessment
        pool_stats = detailed_metrics.get("connection_pool", {})
        if pool_stats:
            total_connections = pool_stats.get("total_connections", 0)
            available_connections = pool_stats.get("available_connections", 0)
            limit = pool_stats.get("limit", 100)
            
            enhanced_metrics["pool_health"] = {
                "utilization_percentage": (total_connections / limit * 100) if limit > 0 else 0,
                "available_percentage": (available_connections / total_connections * 100) if total_connections > 0 else 100,
                "status": "healthy" if total_connections < limit * 0.8 else "high_utilization"
            }
        
        return enhanced_metrics
        
    except Exception as e:
        logger.error(f"Error getting MCP detailed metrics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get MCP metrics: {str(e)}")


@monitoring_router.post("/reset-alerts", response_model=Dict[str, Any])
async def reset_monitoring_alerts():
    """
    Reset/clear all active monitoring alerts.
    
    Useful for clearing alerts after addressing issues or during maintenance.
    Alert history is preserved for audit purposes.
    """
    try:
        monitor = get_circuit_breaker_monitor()
        
        # Count alerts before clearing
        alerts_cleared = len(monitor.alerts)
        
        # Clear active alerts (but preserve history)
        monitor.alerts.clear()
        
        logger.info(f"Cleared {alerts_cleared} active monitoring alerts")
        
        return {
            "success": True,
            "message": f"Cleared {alerts_cleared} active alerts",
            "alerts_cleared": alerts_cleared,
            "history_preserved": len(monitor.alert_history)
        }
        
    except Exception as e:
        logger.error(f"Error resetting monitoring alerts: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset alerts: {str(e)}")