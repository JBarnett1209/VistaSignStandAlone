"""
Request Logging Middleware.

Logs every request/response to stdout and persists a single audit row per
request to the application_logs table.

IMPORTANT: this deliberately does NOT attach a logging.Handler to the root
logger. The previous DatabaseLoggingMiddleware did exactly that on every
request, which meant:
  * every record that propagated to root (including SQLAlchemy echo=True SQL in
    DEBUG) was written to the DB, and
  * under concurrency each in-flight request added its own handler, so a single
    log line was written once per active request (N x write amplification),
    while the log-insert SQL was itself echoed and re-captured.
That write storm is the most likely cause of the "server freezing" the
emergency commits were chasing. Here we write exactly one row per request.
"""

import time
import uuid as uuidlib
from typing import Callable, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.logging_service import get_logger, set_request_context, clear_request_context

logger = get_logger(__name__)


def _parse_uuid(value: Optional[str]):
    try:
        return uuidlib.UUID(value) if value else None
    except (ValueError, TypeError):
        return None


async def _persist_request_log(**fields) -> None:
    """Write a single audit row to its own short-lived DB session."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.log import ApplicationLog

        async with AsyncSessionLocal() as db:
            db.add(ApplicationLog(
                level=fields["level"],
                logger_name="request_audit",
                message=fields["message"][:10000],
                endpoint=(fields.get("endpoint") or "")[:200] or None,
                method=(fields.get("method") or "")[:10] or None,
                status_code=fields.get("status_code"),
                response_time_ms=fields.get("response_time_ms"),
                request_id=(fields.get("request_id") or "")[:100] or None,
                user_id=_parse_uuid(fields.get("user_id")),
                ip_address=(fields.get("client_ip") or "")[:45] or None,
                user_agent=fields.get("user_agent"),
                exception_type=fields.get("exception_type"),
                exception_message=fields.get("exception_message"),
            ))
            await db.commit()
    except Exception as e:
        # Audit logging must never break a request.
        logger.warning(f"Failed to persist request log: {e}")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log each request/response to stdout and persist one audit row to the DB."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.logger = get_logger("request_middleware")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = str(uuidlib.uuid4())

        # Best-effort user id from a bearer token (for audit context only).
        user_id = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from app.core.security.auth import auth_handler
                payload = auth_handler.decode_token(auth_header[7:])
                if payload.get("type") == "access":
                    user_id = payload.get("sub")
            except Exception:
                pass

        session_id = request.cookies.get("vst_refresh")
        set_request_context(request_id, user_id, session_id)

        endpoint = str(request.url.path)
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        # Auth endpoints are noisy/sensitive; log to stdout but don't persist.
        persist = not endpoint.startswith("/api/v1/auth/")

        start_time = time.time()
        self.logger.api_request(method=request.method, endpoint=endpoint, user_id=user_id,
                                extra_data={"request_id": request_id})

        try:
            response = await call_next(request)
            response_time_ms = int((time.time() - start_time) * 1000)

            self.logger.api_response(method=request.method, endpoint=endpoint,
                                     status_code=response.status_code,
                                     response_time_ms=response_time_ms, user_id=user_id,
                                     extra_data={"request_id": request_id})
            response.headers["X-Request-ID"] = request_id

            if persist:
                await _persist_request_log(
                    level="ERROR" if response.status_code >= 400 else "INFO",
                    message=f"{request.method} {endpoint} -> {response.status_code} ({response_time_ms}ms)",
                    request_id=request_id, user_id=user_id, endpoint=endpoint,
                    method=request.method, status_code=response.status_code,
                    response_time_ms=response_time_ms, client_ip=client_ip, user_agent=user_agent,
                )
            return response

        except Exception as e:
            response_time_ms = int((time.time() - start_time) * 1000)
            self.logger.error(
                f"Request failed: {request.method} {endpoint} - {str(e)}",
                extra_data={"request_id": request_id},
                endpoint=endpoint, method=request.method,
                status_code=500, response_time_ms=response_time_ms,
            )
            if persist:
                await _persist_request_log(
                    level="ERROR",
                    message=f"{request.method} {endpoint} -> 500 ({response_time_ms}ms): {str(e)}",
                    request_id=request_id, user_id=user_id, endpoint=endpoint,
                    method=request.method, status_code=500, response_time_ms=response_time_ms,
                    client_ip=client_ip, user_agent=user_agent,
                    exception_type=type(e).__name__, exception_message=str(e),
                )
            raise
        finally:
            clear_request_context()
