"""
Slack notification helper.
"""

import json
import requests
from typing import Optional, Dict, Any
from app.core.config import settings


def post_slack_webhook(text: str, blocks: Optional[list[Dict[str, Any]]] = None) -> bool:
    url = settings.SLACK_WEBHOOK_URL
    if not url:
        return False
    payload: Dict[str, Any] = {"text": text}
    if blocks:
        payload["blocks"] = blocks
    resp = requests.post(url, data=json.dumps(payload), headers={"Content-Type": "application/json"}, timeout=10)
    return resp.status_code in (200, 204)


