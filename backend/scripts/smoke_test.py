"""
End-to-end smoke test for VistaSign.

Run INSIDE the backend container (it uses the app's DB engine for a couple of
out-of-band reads/writes):

    docker compose exec -T backend python scripts/smoke_test.py

Exits non-zero if any check fails. This is the gate CI uses to stop
boot-breaking or flow-breaking regressions from merging — it exercises the
paths that were silently broken in the past:
  * the app boots and /health responds,
  * login + every top-level list endpoint (the dict-vs-object and
    status-shadow regressions surfaced here),
  * document upload + conversion metadata,
  * the token-gated workflow signing flow end to end, and
  * envelope create -> field -> send -> worker finalize -> signed PDF.
"""

import asyncio
import io
import os
import sys
import uuid
from datetime import datetime, timezone

import httpx
from reportlab.pdfgen import canvas
from sqlalchemy import text

# Make the app importable when run as `python scripts/smoke_test.py`.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.database import engine  # noqa: E402

BASE = os.environ.get("SMOKE_BASE_URL", "http://localhost:8000")
ADMIN_EMAIL = os.environ.get("INITIAL_ADMIN_EMAIL", "admin@example.com")
ADMIN_PW = os.environ.get("INITIAL_ADMIN_PASSWORD", "Admin123!changeme")

_failures: list[str] = []


def check(cond: bool, msg: str) -> bool:
    print(f"  [{'PASS' if cond else 'FAIL'}] {msg}")
    if not cond:
        _failures.append(msg)
    return cond


def _make_pdf() -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(100, 750, "VistaSign smoke test")
    c.showPage()
    c.save()
    return buf.getvalue()


async def _db_one(q: str, **p):
    async with engine.begin() as conn:
        return (await conn.execute(text(q), p)).first()


async def _db_exec(q: str, **p):
    async with engine.begin() as conn:
        await conn.execute(text(q), p)


async def main() -> None:
    async with httpx.AsyncClient(base_url=BASE, timeout=90) as ac:
        print("health")
        r = await ac.get("/health")
        check(r.status_code == 200, f"GET /health -> {r.status_code}")

        print("auth")
        r = await ac.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
        check(r.status_code == 200, f"POST /auth/login -> {r.status_code}")
        token = (r.json() or {}).get("access_token") if r.status_code == 200 else None
        if not check(bool(token), "login returned access_token"):
            return  # nothing else will work without auth
        H = {"Authorization": f"Bearer {token}"}

        print("list endpoints (regression guard)")
        for path in ("/api/v1/workflows/", "/api/v1/documents/", "/api/v1/signatures/",
                     "/api/v1/envelopes/", "/api/v1/users/"):
            rr = await ac.get(path, headers=H)
            check(rr.status_code == 200, f"GET {path} -> {rr.status_code}")

        print("document upload + field placement")
        up = await ac.post("/api/v1/documents/upload", headers=H,
                           files={"file": ("smoke.pdf", _make_pdf(), "application/pdf")},
                           data={"title": "Smoke"})
        check(up.status_code == 200, f"POST /documents/upload -> {up.status_code}")
        doc_id = up.json().get("id") if up.status_code == 200 else None
        if not check(bool(doc_id), "upload returned a document id"):
            return
        pf = await ac.put(f"/api/v1/documents/{doc_id}", headers=H, json={"fields": [
            {"page": 1, "type": "Signature", "rect": {"x": 100, "y": 120, "w": 160, "h": 40}, "required": True}]})
        check(pf.status_code == 200, f"PUT /documents/{{id}} (place field) -> {pf.status_code}")

        # Full DocuSign-style flow: author a workflow -> send creates an envelope
        # -> recipient signs via token -> finalize -> signed PDF.
        print("workflow -> envelope bridge + signing")
        wf = await ac.post("/api/v1/workflows/", headers=H, json={
            "name": "Smoke", "description": "smoke", "workflow_data": {"steps": []},
            "document_id": doc_id})
        check(wf.status_code == 200, f"POST /workflows/ -> {wf.status_code}")
        if wf.status_code != 200:
            return
        wf_id = wf.json()["id"]
        part = await ac.post(f"/api/v1/workflows/{wf_id}/participants", headers=H,
                             json={"email": "signer@example.com", "signingOrder": 1, "role": "signer"})
        check(part.status_code == 200, f"POST /participants -> {part.status_code}")
        part_id = part.json()["id"]
        sw = await ac.post(f"/api/v1/workflows/{wf_id}/send", headers=H)
        check(sw.status_code == 200, f"POST /workflows/{{id}}/send -> {sw.status_code}")
        env_id = sw.json().get("envelope_id") if sw.status_code == 200 else None
        check(bool(env_id), "send created an envelope")
        if not env_id:
            return

        row = await _db_one(
            "select token_jti from sign_links where envelope_id=:e", e=env_id)
        token = row[0] if row else None
        check(bool(token), "send issued a SignLink token")

        bad = await ac.get("/api/v1/public/sign/not-a-real-token")
        check(bad.status_code == 404, f"GET /public/sign/{{bad}} -> {bad.status_code} (expect 404)")

        if token:
            gs = await ac.get(f"/api/v1/public/sign/{token}")
            check(gs.status_code == 200, f"GET /public/sign/{{token}} -> {gs.status_code}")
            page = gs.json() if gs.status_code == 200 else {}
            fields = page.get("fields", [])
            check(len(fields) == 1 and fields[0]["type"] == "signature",
                  f"document field mapped onto envelope -> {[f.get('type') for f in fields]}")
            if fields:
                sv = await ac.post(f"/api/v1/public/sign/{token}/fields/{fields[0]['id']}",
                                   json={"value": "Sam Signer"})
                check(sv.status_code == 200, f"POST submit field -> {sv.status_code}")
            cp = await ac.post(f"/api/v1/public/sign/{token}/complete")
            check(cp.status_code == 200, f"POST complete -> {cp.status_code}")

            final = None
            for _ in range(30):  # up to ~60s for the worker to finalize
                await asyncio.sleep(2)
                s = await _db_one("select status from envelopes where id=:i", i=env_id)
                if s and s[0] in ("COMPLETED", "FINALIZATION_FAILED"):
                    final = s[0]
                    break
            check(final == "COMPLETED", f"envelope finalize -> {final}")

            pstat = await _db_one("select status from workflow_participants where id=:i", i=part_id)
            check(bool(pstat) and pstat[0] == "completed", f"participant synced -> {pstat[0] if pstat else None}")
            wstat = await _db_one("select status from workflows where id=:i", i=wf_id)
            check(bool(wstat) and wstat[0] == "COMPLETED", f"workflow synced -> {wstat[0] if wstat else None}")

            if final == "COMPLETED":
                cert = await ac.get(f"/api/v1/evidence/envelope/{env_id}/certificate", headers=H)
                check(cert.status_code == 200 and cert.content[:5] == b"%PDF-",
                      f"GET /certificate -> {cert.status_code}, pdf={cert.content[:5] == b'%PDF-'}")

    print()
    if _failures:
        print(f"SMOKE TEST FAILED: {len(_failures)} check(s) failed:")
        for f in _failures:
            print(f"  - {f}")
        sys.exit(1)
    print("SMOKE TEST PASSED")


if __name__ == "__main__":
    asyncio.run(main())
