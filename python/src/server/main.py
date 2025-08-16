"""
FastAPI Backend for Archon Knowledge Engine

This is the main entry point for the Archon backend API.
It uses a modular approach with separate API modules for different functionality.

Modules:
- settings_api: Settings and credentials management
- mcp_api: MCP server management and WebSocket streaming
- knowledge_api: Knowledge base, crawling, and RAG operations
- projects_api: Project and task management with streaming
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api_routes.agent_chat_api import router as agent_chat_router
from .api_routes.bug_report_api import router as bug_report_router
from .api_routes.coverage_api import router as coverage_router
from .api_routes.internal_api import router as internal_router
from .api_routes.knowledge_api import router as knowledge_router
from .api_routes.mcp_api import router as mcp_router
from .api_routes.monitoring import monitoring_router
from .api_routes.projects_api import router as projects_router

# Import Socket.IO handlers to ensure they're registered
from .api_routes import socketio_handlers  # This registers all Socket.IO event handlers

# Import modular API routers
from .api_routes.settings_api import router as settings_router
from .api_routes.tests_api import router as tests_router
from .api_routes.auth_api import router as auth_router

# Import Logfire configuration
from .config.logfire_config import api_logger, setup_logfire

# Import structured logging and correlation middleware
from .logging.structured_logger import get_logger, set_correlation_id
from .middleware.correlation_middleware import add_correlation_middleware
from .services.background_task_manager import cleanup_task_manager
from .services.crawler_manager import cleanup_crawler, initialize_crawler

# Import utilities and core classes
from .services.credential_service import initialize_credentials

# Import Socket.IO integration
from .socketio_app import create_socketio_app

# Import missing dependencies that the modular APIs need
try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig
except ImportError:
    # These are optional dependencies for full functionality
    AsyncWebCrawler = None
    BrowserConfig = None

# Enhanced structured logger
logger = get_logger(__name__)

# Set up logging configuration to reduce noise

# Override uvicorn's access log format to be less verbose
uvicorn_logger = logging.getLogger("uvicorn.access")
uvicorn_logger.setLevel(logging.WARNING)  # Only log warnings and errors, not every request

# CrawlingContext has been replaced by CrawlerManager in services/crawler_manager.py

# Global flag to track if initialization is complete
_initialization_complete = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown tasks."""
    global _initialization_complete
    _initialization_complete = False

    # Startup
    logger.info("🚀 Starting Archon backend...")

    try:
        # Initialize credentials from database FIRST - this is the foundation for everything else
        await initialize_credentials()

        # Now that credentials are loaded, we can properly initialize logging
        # This must happen AFTER credentials so LOGFIRE_ENABLED is set from database
        setup_logfire(service_name="archon-backend")

        # Now we can safely use the logger
        logger.info("✅ Credentials initialized")
        api_logger.info("🔥 Logfire initialized for backend")
        
        # Initialize structured logging and correlation middleware
        logger.info("🔗 Initializing structured logging with correlation IDs...")

        # Initialize OpenTelemetry and Prometheus metrics for production monitoring
        try:
            from .observability.opentelemetry_config import setup_opentelemetry
            from .monitoring.prometheus_metrics import start_metrics_server
            
            # Setup OpenTelemetry distributed tracing
            otel_success = setup_opentelemetry()
            if otel_success:
                api_logger.info("✅ OpenTelemetry distributed tracing initialized")
            else:
                api_logger.info("⚠️ OpenTelemetry disabled or failed to initialize")
            
            # Start Prometheus metrics server for production monitoring
            metrics_port = int(os.getenv("PROMETHEUS_PORT", "8000"))
            metrics_success = await start_metrics_server(metrics_port)
            if metrics_success:
                api_logger.info(f"✅ Prometheus metrics server started on port {metrics_port}")
            else:
                api_logger.warning(f"⚠️ Failed to start Prometheus metrics server on port {metrics_port}")
                
        except Exception as e:
            api_logger.warning(f"Could not initialize production monitoring: {e}")

        # Initialize crawling context
        try:
            await initialize_crawler()
        except Exception as e:
            api_logger.warning(f"Could not fully initialize crawling context: {str(e)}")

        # Make crawling context available to modules
        # Crawler is now managed by CrawlerManager

        # Initialize Socket.IO services
        try:
            # Import API modules to register their Socket.IO handlers
            api_logger.info("✅ Socket.IO handlers imported from API modules")
        except Exception as e:
            api_logger.warning(f"Could not initialize Socket.IO services: {e}")

        # Initialize prompt service
        try:
            from .services.prompt_service import prompt_service

            await prompt_service.load_prompts()
            api_logger.info("✅ Prompt service initialized")
        except Exception as e:
            api_logger.warning(f"Could not initialize prompt service: {e}")

        # Initialize Redis cache service for beta performance enhancement
        try:
            from .services.cache_service import cache_service

            cache_available = await cache_service.initialize()
            if cache_available:
                api_logger.info("✅ Redis cache service initialized - beta performance enhancement active")
            else:
                api_logger.info("⚠️ Redis cache service unavailable - falling back to database only")
        except Exception as e:
            api_logger.warning(f"Could not initialize cache service: {e}")

        # Initialize HTTP client service for connection pooling
        try:
            from .services.http_client_service import initialize_http_client

            http_client_available = await initialize_http_client()
            if http_client_available:
                api_logger.info("✅ HTTP client service initialized - connection pooling active")
            else:
                api_logger.warning("⚠️ HTTP client service unavailable - using default requests")
        except Exception as e:
            api_logger.warning(f"Could not initialize HTTP client service: {e}")

        # Initialize circuit breaker monitoring for MCP services
        try:
            from .services.circuit_breaker_monitor import start_circuit_breaker_monitoring

            await start_circuit_breaker_monitoring()
            api_logger.info("✅ Circuit breaker monitoring started - MCP service health tracking active")
        except Exception as e:
            api_logger.warning(f"Could not initialize circuit breaker monitoring: {e}")

        # Set the main event loop for background tasks
        try:
            from .services.background_task_manager import get_task_manager

            task_manager = get_task_manager()
            current_loop = asyncio.get_running_loop()
            task_manager.set_main_loop(current_loop)
            api_logger.info("✅ Main event loop set for background tasks")
        except Exception as e:
            api_logger.warning(f"Could not set main event loop: {e}")

        # MCP Client functionality removed from architecture
        # Agents now use MCP tools directly

        # Mark initialization as complete
        _initialization_complete = True
        api_logger.info("🎉 Archon backend started successfully!")

    except Exception as e:
        api_logger.error(f"❌ Failed to start backend: {str(e)}")
        raise

    yield

    # Shutdown
    _initialization_complete = False
    api_logger.info("🛑 Shutting down Archon backend...")

    try:
        # MCP Client cleanup not needed

        # Cleanup crawling context
        try:
            await cleanup_crawler()
        except Exception as e:
            api_logger.warning(f"Could not cleanup crawling context: {str(e)}")

        # Cleanup background task manager
        try:
            await cleanup_task_manager()
            api_logger.info("Background task manager cleaned up")
        except Exception as e:
            api_logger.warning(f"Could not cleanup background task manager: {str(e)}")

        # Cleanup Redis cache service
        try:
            from .services.cache_service import cache_service
            await cache_service.close()
            api_logger.info("Redis cache service closed")
        except Exception as e:
            api_logger.warning(f"Could not cleanup cache service: {str(e)}")

        # Cleanup HTTP client service
        try:
            from .services.http_client_service import cleanup_http_client
            await cleanup_http_client()
            api_logger.info("HTTP client service closed")
        except Exception as e:
            api_logger.warning(f"Could not cleanup HTTP client service: {str(e)}")

        # Cleanup circuit breaker monitoring
        try:
            from .services.circuit_breaker_monitor import stop_circuit_breaker_monitoring
            await stop_circuit_breaker_monitoring()
            api_logger.info("Circuit breaker monitoring stopped")
        except Exception as e:
            api_logger.warning(f"Could not cleanup circuit breaker monitoring: {str(e)}")

        # Cleanup monitoring services
        try:
            from .monitoring.prometheus_metrics import stop_metrics_monitoring
            await stop_metrics_monitoring()
            api_logger.info("Prometheus metrics monitoring stopped")
        except Exception as e:
            api_logger.warning(f"Could not cleanup monitoring services: {str(e)}")

        api_logger.info("✅ Cleanup completed")

    except Exception as e:
        api_logger.error(f"❌ Error during shutdown: {str(e)}")


# Create FastAPI application
app = FastAPI(
    title="Archon Knowledge Engine API",
    description="Backend API for the Archon knowledge management and project automation platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Import security configuration and authentication middleware
from .config.security_config import get_security_settings
from .middleware.auth_middleware import setup_authentication_middleware
from .middleware.security_middleware import setup_security_middleware
from .middleware.rate_limit_middleware import setup_rate_limiting

# Get security settings
security_settings = get_security_settings()

# Configure CORS with secure settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=security_settings.allowed_origins,  # Restricted to specific origins
    allow_credentials=security_settings.allow_credentials,
    allow_methods=security_settings.allowed_methods,
    allow_headers=security_settings.allowed_headers,
)

# Setup comprehensive security middleware stack
# Order matters: authentication -> rate limiting -> security headers
auth_enabled = os.getenv("AUTH_ENABLED", "true").lower() == "true"
setup_authentication_middleware(app, enable_auth=auth_enabled)

# Add rate limiting middleware
rate_limit_enabled = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
if rate_limit_enabled:
    setup_rate_limiting(app)

# Add comprehensive security middleware
security_headers_enabled = os.getenv("SECURITY_HEADERS_ENABLED", "true").lower() == "true"
if security_headers_enabled:
    setup_security_middleware(app)

# Add structured logging and correlation middleware
# This should be added after security middleware but before route handlers
add_correlation_middleware(app)
logger.info("✅ Structured logging and correlation middleware configured")


# Add middleware to skip logging for health checks
@app.middleware("http")
async def skip_health_check_logs(request, call_next):
    # Skip logging for health check endpoints
    if request.url.path in ["/health", "/api/health"]:
        # Temporarily suppress the log
        import logging

        logger = logging.getLogger("uvicorn.access")
        old_level = logger.level
        logger.setLevel(logging.ERROR)
        response = await call_next(request)
        logger.setLevel(old_level)
        return response
    return await call_next(request)


# Include API routers
app.include_router(settings_router)
app.include_router(mcp_router)
# app.include_router(mcp_client_router)  # Removed - not part of new architecture
app.include_router(knowledge_router)
app.include_router(projects_router)
app.include_router(tests_router)
app.include_router(agent_chat_router)
app.include_router(internal_router)
app.include_router(coverage_router)
app.include_router(bug_report_router)
app.include_router(auth_router)
app.include_router(monitoring_router)

# Include logging examples for monitoring demonstration
try:
    from .api_routes.logging_example import router as logging_example_router
    app.include_router(logging_example_router)
    logger.info("✅ Logging example routes included for monitoring demonstration")
except ImportError:
    logger.info("⚠️ Logging example routes not found - monitoring examples unavailable")


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint returning API information."""
    return {
        "name": "Archon Knowledge Engine API",
        "version": "1.0.0",
        "description": "Backend API for knowledge management and project automation",
        "status": "healthy",
        "modules": ["settings", "mcp", "mcp-clients", "knowledge", "projects"],
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint that indicates true readiness including credential loading."""
    from datetime import datetime

    # Check if initialization is complete
    if not _initialization_complete:
        return {
            "status": "initializing",
            "service": "archon-backend",
            "timestamp": datetime.now().isoformat(),
            "message": "Backend is starting up, credentials loading...",
            "ready": False,
        }

    return {
        "status": "healthy",
        "service": "archon-backend",
        "timestamp": datetime.now().isoformat(),
        "ready": True,
        "credentials_loaded": True,
    }


# API health check endpoint (alias for /health at /api/health)
@app.get("/api/health")
async def api_health_check():
    """API health check endpoint - alias for /health."""
    return await health_check()


# Create Socket.IO app wrapper
# This wraps the FastAPI app with Socket.IO functionality
socket_app = create_socketio_app(app)

# Export the socket_app for uvicorn to use
# The socket_app still handles all FastAPI routes, but also adds Socket.IO support


def main():
    """Main entry point for running the server."""
    import uvicorn

    # Require ARCHON_SERVER_PORT to be set
    server_port = os.getenv("ARCHON_SERVER_PORT")
    if not server_port:
        raise ValueError(
            "ARCHON_SERVER_PORT environment variable is required. "
            "Please set it in your .env file or environment. "
            "Default value: 8181"
        )

    uvicorn.run(
        "src.server.main:socket_app",
        host="0.0.0.0",
        port=int(server_port),
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()
