"""
ACME watcher integrated into VistaSign backend.
"""

import asyncio
import os
import time
import json
import hashlib
import requests
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

ACME_PATH = "/letsencrypt/acme.json"
INTERVAL = 15


def post_slack(text: str):
    if not settings.SLACK_WEBHOOK_URL:
        logger.info("No SLACK_WEBHOOK_URL configured")
        return
    try:
        logger.info(f"Sending to Slack: {text}")
        resp = requests.post(settings.SLACK_WEBHOOK_URL, json={"text": text}, timeout=10)
        logger.info(f"Slack response: {resp.status_code}")
        if resp.status_code not in (200, 204):
            logger.error(f"Slack error: {resp.text}")
    except Exception as e:
        logger.error(f"Slack notification failed: {e}")


def current_digest(path: str) -> str:
    try:
        with open(path, "rb") as f:
            data = f.read()
        return hashlib.sha256(data).hexdigest()
    except FileNotFoundError:
        return ""


def summarize_acme(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return ""
    certs = []
    for store in (data.get("Certificates") or []):
        domain_main = store.get("domain", {}).get("main")
        sans = store.get("domain", {}).get("sans", [])
        certs.append((domain_main, sans))
    lines = ["🔐 VistaSign: Traefik ACME certificates updated:"]
    for main, sans in certs:
        if not main:
            continue
        if sans:
            lines.append(f"• {main} (SANs: {', '.join(sans)})")
        else:
            lines.append(f"• {main}")
    return "\n".join(lines)


async def acme_watcher_task():
    """Background task to monitor ACME certificates."""
    logger.info(f"🔍 ACME watcher starting - monitoring {ACME_PATH}")
    logger.info(f"Slack webhook: {'configured' if settings.SLACK_WEBHOOK_URL else 'NOT configured'}")
    
    last = ""
    # Initial state
    last = current_digest(ACME_PATH)
    if last:
        logger.info("Initial ACME state detected")
        msg = summarize_acme(ACME_PATH)
        if msg:
            post_slack(msg)
    
    while True:
        await asyncio.sleep(INTERVAL)
        dig = current_digest(ACME_PATH)
        if dig and dig != last:
            logger.info(f"ACME file changed: {dig[:8]}...")
            last = dig
            msg = summarize_acme(ACME_PATH)
            if msg:
                post_slack(msg)
