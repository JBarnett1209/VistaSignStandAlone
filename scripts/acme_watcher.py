#!/usr/bin/env python3
import os
import time
import json
import hashlib
import requests

ACME_PATH = os.environ.get("ACME_PATH", "/letsencrypt/acme.json")
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL")
INTERVAL = int(os.environ.get("WATCH_INTERVAL", "15"))


def post_slack(text: str):
    if not SLACK_WEBHOOK_URL:
        print("No SLACK_WEBHOOK_URL configured")
        return
    try:
        print(f"Sending to Slack: {text}")
        resp = requests.post(SLACK_WEBHOOK_URL, json={"text": text}, timeout=10)
        print(f"Slack response: {resp.status_code}")
        if resp.status_code not in (200, 204):
            print(f"Slack error: {resp.text}")
    except Exception as e:
        print(f"Slack notification failed: {e}")


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
    lines = ["Traefik ACME updated: certificates present:"]
    for main, sans in certs:
        if not main:
            continue
        if sans:
            lines.append(f"- {main} (SANs: {', '.join(sans)})")
        else:
            lines.append(f"- {main}")
    return "\n".join(lines)


def main():
    print(f"ACME watcher starting - monitoring {ACME_PATH}")
    print(f"Slack webhook: {'configured' if SLACK_WEBHOOK_URL else 'NOT configured'}")
    
    last = ""
    # Initial state
    last = current_digest(ACME_PATH)
    if last:
        print("Initial ACME state detected")
        msg = summarize_acme(ACME_PATH)
        if msg:
            post_slack(msg)
    
    while True:
        time.sleep(INTERVAL)
        dig = current_digest(ACME_PATH)
        if dig and dig != last:
            print(f"ACME file changed: {dig[:8]}...")
            last = dig
            msg = summarize_acme(ACME_PATH)
            if msg:
                post_slack(msg)


if __name__ == "__main__":
    main()


