"""
Socket.IO server scaffolding for envelope live updates.
"""

import socketio
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)


@sio.event
async def connect(sid, environ):
    await sio.save_session(sid, {})
    logger.info(f"Client connected: {sid}")


@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")


@sio.event
async def join_envelope(sid, data):
    env_id = data.get("envelope_id")
    if env_id:
        await sio.enter_room(sid, f"envelope:{env_id}")
        logger.info(f"Client {sid} joined envelope room: {env_id}")


class RealtimeService:
    """Handles Socket.IO real-time communication."""

    async def emit_to_room(self, room: str, event_name: str, data: Dict[str, Any]):
        """Emit an event to a specific Socket.IO room."""
        logger.info(f"Emitting event '{event_name}' to room '{room}' with data: {data}")
        await sio.emit(event_name, data, room=room)

    async def emit_to_all(self, event_name: str, data: Dict[str, Any]):
        """Emit an event to all connected clients."""
        logger.info(f"Emitting event '{event_name}' to all clients with data: {data}")
        await sio.emit(event_name, data)


# Create singleton instance
realtime_service = RealtimeService()


async def emit_field_update(envelope_id: str, payload: dict):
    await sio.emit("field.updated", payload, room=f"envelope:{envelope_id}")


async def emit_envelope_status(envelope_id: str, payload: dict):
    await sio.emit("envelope.status", payload, room=f"envelope:{envelope_id}")


