"""
Agent Chat API - Socket.IO-based chat with SSE proxy to AI agents
"""

import asyncio
import json

# Import logging
import logging
import os
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException, Depends, status, Path
from pydantic import BaseModel, Field, validator
from typing import Literal, Optional

logger = logging.getLogger(__name__)

# Import Socket.IO instance
from ..socketio_app import get_socketio_instance
from ..middleware.auth_middleware import require_authentication

sio = get_socketio_instance()

# Create router
router = APIRouter(prefix="/api/agent-chat", tags=["agent-chat"], dependencies=[Depends(require_authentication)])

# Simple in-memory session storage
sessions: dict[str, dict] = {}

# Message/context size caps (placed before models to avoid NameError)
MAX_MESSAGE_LEN = 8192
MAX_CONTEXT_BYTES = 32 * 1024  # 32KB

# Allowed agent types and UUID validation
ALLOWED_AGENT_TYPES = {"rag", "document"}
UUID_V4_REGEX = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"

def is_valid_uuid4(value: str) -> bool:
    try:
        uuid_obj = uuid.UUID(value, version=4)
        # Ensure canonical string preserves version 4
        return str(uuid_obj) == value.lower()
    except (ValueError, AttributeError, TypeError):
        return False


# REST Endpoints (minimal for frontend compatibility)
@router.post("/sessions", response_model=CreateSessionResponse)
async def create_session(request: CreateSessionRequest):
    """Create a new chat session."""
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "id": session_id,
        "session_id": session_id,  # Frontend expects this
        "project_id": request.project_id,
        "agent_type": request.agent_type,
        "messages": [],
        "created_at": datetime.now().isoformat(),
    }
    logger.info(f"Created chat session {session_id} with agent_type: {request.agent_type}")
    return {"session_id": session_id}


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str = Path(
        ...,
        regex=UUID_V4_REGEX,
        min_length=36,
        max_length=36,
        description="Chat session UUID (v4)",
    )
):
    """Get session information."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]


@router.post("/sessions/{session_id}/messages", response_model=SendMessageResponse)
async def send_message(
    session_id: str = Path(
        ...,
        regex=UUID_V4_REGEX,
        min_length=36,
        max_length=36,
        description="Chat session UUID (v4)",
    ),
    request: SendMessageRequest = ...,
):
    """REST endpoint for sending messages (triggers Socket.IO event internally)."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
 
    # Model validators already enforce message and context constraints.
    # Additional hard cap for oversized message (defense in depth).
    if len(request.message) > MAX_MESSAGE_LEN:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Message too large (&gt;{MAX_MESSAGE_LEN} chars)",
        )
 
    # Store user message
    user_msg = {
        "id": str(uuid.uuid4()),
        "content": request.message,
        "sender": "user",
        "timestamp": datetime.now().isoformat(),
    }
    sessions[session_id]["messages"].append(user_msg)

    # Emit to Socket.IO room
    await sio.emit("message", {"type": "message", "data": user_msg}, room=f"chat_{session_id}")

    # Trigger agent response via Socket.IO
    asyncio.create_task(
        process_agent_response(session_id, request.message, request.context or {})
    )

    return {"status": "sent"}


# Socket.IO Event Handlers
@sio.event
async def join_chat(sid, data):
    """Join a chat room."""
    session_id = data.get("session_id")
    if not session_id or not is_valid_uuid4(session_id):
        await sio.emit("error", {"type": "error", "error": "Invalid or missing session_id"}, to=sid)
        return
    if session_id not in sessions:
        await sio.emit("error", {"type": "error", "error": "Session not found"}, to=sid)
        return
    await sio.enter_room(sid, f"chat_{session_id}")
    logger.info(f"Client {sid} joined chat room {session_id}")
    # Send connection confirmation
    await sio.emit(
        "connection_confirmed",
        {"type": "connection_confirmed", "session_id": session_id},
        to=sid,
    )


@sio.event
async def leave_chat(sid, data):
    """Leave a chat room."""
    session_id = data.get("session_id")
    if not session_id or not is_valid_uuid4(session_id):
        await sio.emit("error", {"type": "error", "error": "Invalid or missing session_id"}, to=sid)
        return
    if session_id not in sessions:
        await sio.emit("error", {"type": "error", "error": "Session not found"}, to=sid)
        return
    await sio.leave_room(sid, f"chat_{session_id}")
    logger.info(f"Client {sid} left chat room {session_id}")


@sio.event
async def chat_message(sid, data):
    """Handle chat message via Socket.IO."""
    session_id = data.get("session_id")
    message = data.get("message")
    context = data.get("context", {})
 
    if not session_id or not is_valid_uuid4(session_id):
        await sio.emit("error", {"type": "error", "error": "Invalid or missing session_id"}, to=sid)
        return
    if session_id not in sessions:
        await sio.emit("error", {"type": "error", "error": "Session not found"}, to=sid)
        return
    if not message:
        await sio.emit("error", {"type": "error", "error": "Missing message"}, to=sid)
        return
    # Validate sizes in Socket.IO path
    try:
        if len(message) > MAX_MESSAGE_LEN:
            await sio.emit("error", {"type": "error", "error": f"Message too large (&gt;{MAX_MESSAGE_LEN} chars)"}, to=sid)
            return
        if context is not None:
            ctx_bytes = len(json.dumps(context))
            if ctx_bytes > MAX_CONTEXT_BYTES:
                await sio.emit("error", {"type": "error", "error": f"Context too large (&gt;{MAX_CONTEXT_BYTES} bytes)"}, to=sid)
                return
    except Exception:
        await sio.emit("error", {"type": "error", "error": "Invalid context format"}, to=sid)
        return

    # Store user message
    if session_id in sessions:
        user_msg = {
            "id": str(uuid.uuid4()),
            "content": message,
            "sender": "user",
            "timestamp": datetime.now().isoformat(),
        }
        sessions[session_id]["messages"].append(user_msg)

        # Echo user message to room
        await sio.emit("message", {"type": "message", "data": user_msg}, room=f"chat_{session_id}")

    # Process agent response
    await process_agent_response(session_id, message, context)


# Helper function to process agent responses
async def process_agent_response(session_id: str, message: str, context: dict):
    """Stream agent response via SSE and emit to Socket.IO."""
    if session_id not in sessions:
        return
 
    agent_type = sessions[session_id].get("agent_type", "rag")
    if agent_type not in ALLOWED_AGENT_TYPES:
        agent_type = "rag"
    room = f"chat_{session_id}"

    # Emit typing indicator
    await sio.emit("typing", {"type": "typing", "is_typing": True}, room=room)

    try:
        # Call agents service with SSE streaming
        # Resolve agents base URL with sensible defaults
        host = os.getenv("ARCHON_AGENTS_HOST", "localhost")
        port = os.getenv("ARCHON_AGENTS_PORT", "8052")
        base = os.getenv("ARCHON_AGENTS_BASE_URL", f"http://{host}:{port}")
        url = f"{base}/agents/{agent_type}/stream"

        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            async with client.stream(
                "POST",
                url,
                json={"agent_type": agent_type, "prompt": message, "context": context},
            ) as response:
                if response.status_code != 200:
                    await sio.emit(
                        "error",
                        {"type": "error", "error": f"Agent service error: {response.status_code}"},
                        room=room,
                    )
                    return

                # Collect chunks for complete message
                full_content = ""

                # Stream SSE chunks to Socket.IO
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            chunk_data = json.loads(line[6:])
                            chunk_content = chunk_data.get("content", "")

                            # Accumulate content
                            full_content += chunk_content

                            # Emit streaming chunk
                            await sio.emit(
                                "stream_chunk",
                                {"type": "stream_chunk", "content": chunk_content},
                                room=room,
                            )

                        except json.JSONDecodeError:
                            logger.warning(f"Failed to parse SSE chunk: {line}")

                # Create complete agent message
                agent_msg = {
                    "id": str(uuid.uuid4()),
                    "content": full_content,
                    "sender": "agent",
                    "agent_type": agent_type,
                    "timestamp": datetime.now().isoformat(),
                }

                # Store in session
                sessions[session_id]["messages"].append(agent_msg)

                # Emit complete message
                await sio.emit("message", {"type": "message", "data": agent_msg}, room=room)

                # Emit stream complete
                await sio.emit("stream_complete", {"type": "stream_complete"}, room=room)

    except Exception as e:
        logger.error(f"Error processing agent response: {e}")
        await sio.emit("error", {"type": "error", "error": "Internal error processing agent response"}, room=room)
    finally:
        # Stop typing indicator
        await sio.emit("typing", {"type": "typing", "is_typing": False}, room=room)
