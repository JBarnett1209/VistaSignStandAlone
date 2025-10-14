# System Flowcharts (ASCII)

## 1. Upload & Ingest

User → /api/documents/upload-url → S3 PUT
           │
           └─> /api/documents/ingest (metadata)
                └─> RQ Job: Scan → Convert → PageCount → Store PDF key

[Scan]
S3 Object → ClamAV → OK? ──No→ quarantine + audit
                    │
                    Yes
                    │
[Convert]
LibreOffice/ImageMagick → PDF → store storage_key_pdf

## 2. Envelope Creation & Editing

/documents/:id/edit → fetch document + fields
Field edits → POST /api/envelopes/{id}/fields (bulk upsert)
Send → POST /api/envelopes/{id}/send
  └─ create sign_links, emit websocket events envelope:{id}

## 3. Public Signing

/sign/:token → verify JWT (envelope_id, recipient_id, exp)
Load fields → autosave on change → POST /sign/{token}/field-values
Complete → validate required → POST /sign/{token}/complete
  └─ If final recipient: finalize envelope

## 4. Finalize (Flatten + Sign + Certificate)

fields + PDF → flatten (PyMuPDF/borb)
Evidence JSON (hash, ip, ua, timestamps)
PDF signing (pyHanko, PKCS#12) → PAdES
Store signed PDF + evidence.json → audit event

## 5. Viewer (Live Tracking)

Open viewer → join socket room envelope:{id}
Server emits events: field.updated, recipient.progress, envelope.status
UI shows progress, recipients, timestamps, remaining fields.
