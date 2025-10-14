"""
Socket.IO server scaffolding for envelope live updates.
"""

import socketio

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)


@sio.event
async def connect(sid, environ):
    await sio.save_session(sid, {})


@sio.event
async def join_envelope(sid, data):
    env_id = data.get("envelope_id")
    if env_id:
        await sio.enter_room(sid, f"envelope:{env_id}")


async def emit_field_update(envelope_id: str, payload: dict):
    await sio.emit("field.updated", payload, room=f"envelope:{envelope_id}")


async def emit_envelope_status(envelope_id: str, payload: dict):
    await sio.emit("envelope.status", payload, room=f"envelope:{envelope_id}")


