from rq import Queue
from redis import from_url
import os

from app.core.config import settings


def get_queue(name: str = "default") -> Queue:
    conn = from_url(settings.REDIS_URL)
    return Queue(name, connection=conn)


def enqueue_ingest(document_id: str, path: str, mime_type: str, title: str) -> str:
    from app.workers.ingest import ingest_document
    q = get_queue("ingest")
    job = q.enqueue(ingest_document, document_id, path, mime_type, title)
    return job.id


def enqueue_finalize(envelope_id: str) -> str:
    """Enqueue envelope finalization job."""
    from app.workers.finalize import finalize_envelope
    q = get_queue("finalize")
    job = q.enqueue(finalize_envelope, envelope_id)
    return job.id


