import asyncio

from rq import Queue
from redis import from_url

from app.core.config import settings


def get_queue(name: str = "default") -> Queue:
    conn = from_url(settings.REDIS_URL)
    return Queue(name, connection=conn)


def _run_finalize(envelope_id: str):
    """Synchronous RQ entrypoint.

    RQ workers are synchronous and call the job target directly. Our job bodies
    are coroutines, so calling them without awaiting would silently no-op
    ("coroutine was never awaited"). Drive the coroutine to completion with a
    fresh event loop here. ``import app.models`` ensures the full SQLAlchemy
    registry is configured in the worker process (the worker never runs
    init_db()).
    """
    import app.models  # noqa: F401  (register all mappers)
    from app.workers.finalize import finalize_envelope

    return asyncio.run(finalize_envelope(envelope_id))


def enqueue_finalize(envelope_id: str) -> str:
    """Enqueue envelope finalization (flatten fields, sign PDF, build evidence)."""
    q = get_queue("finalize")
    job = q.enqueue(_run_finalize, envelope_id)
    return job.id
