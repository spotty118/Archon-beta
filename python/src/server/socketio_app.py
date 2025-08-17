"""
Socket.IO Server Integration for Archon

Simple Socket.IO server setup with FastAPI integration.
All events are handled in projects_api.py using @sio.event decorators.
"""

import logging

import socketio
from fastapi import FastAPI

from .config.logfire_config import safe_logfire_info
from .config.security_config import get_security_settings

logger = logging.getLogger(__name__)

# Create Socket.IO server with FastAPI integration
security_settings = get_security_settings()
allowed_origins = security_settings.allowed_origins or "*"
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=allowed_origins,
    logger=False,  # Disable verbose Socket.IO logging
    engineio_logger=False,
)

# Global Socket.IO instance for use across modules
_socketio_instance: socketio.AsyncServer | None = None


def get_socketio_instance() -> socketio.AsyncServer:
    """Get the global Socket.IO server instance."""
    global _socketio_instance
    if _socketio_instance is None:
        _socketio_instance = sio
    return _socketio_instance


def create_socketio_app(app: FastAPI) -> socketio.ASGIApp:
    """
    Wrap FastAPI app with Socket.IO ASGI app.

    Args:
        app: FastAPI application instance

    Returns:
        Socket.IO ASGI app that wraps the FastAPI app
    """
    # Log Socket.IO server creation
    safe_logfire_info(
        "Creating Socket.IO server", cors_origins=allowed_origins, ping_timeout=300, ping_interval=60
    )

    # Note: Socket.IO event handlers are registered in socketio_handlers.py
    # This module only creates the Socket.IO server instance

    # Create and return the Socket.IO ASGI app
    socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

    # Store the app reference for later use
    sio.app = app

    return socket_app
