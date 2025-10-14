# Implementation TODOs

1. Scaffold monorepo and Docker Compose services (api, web, redis, worker, clamav, libreoffice)
2. Implement PostgreSQL models and Alembic migrations (users, documents, envelopes, recipients, fields, field_values, audit_events, sign_links)
3. JWT auth (access/refresh), tenants, roles; CSRF for public signer POSTs
4. S3 storage service + pre-signed URLs; server-side AES-GCM encryption layer
5. Upload endpoint and ingest pipeline; ClamAV scan; enqueue convert job
6. LibreOffice conversion to PDF; Ghostscript/ImageMagick for images; update page count
7. FastAPI routers: documents, envelopes, public sign; pagination, search, sort
8. Socket.IO namespaces/rooms for envelope live updates
9. React editor: pdf.js canvas, @dnd-kit field palette, inspector, upsert fields
10. React viewer with thumbnails and live status panel
11. Public signing SPA with draw/type/upload signatures, autosave, validation
12. Flatten signed fields into PDF (PyMuPDF/borb) and generate certificate page
13. PKCS#12 signing (pyHanko) to produce PAdES; verify on retrieval
14. Webhooks with HMAC secret; fire lifecycle events
15. CSP, rate limits, audit logs, RLS by tenant; IP/UA capture
16. Vite+TS+Tailwind+shadcn setup, routes, stores (Zustand), api client
17. Seed script and unit tests (conversion, token validation, signature verify)
18. Maintain docs and flowcharts under /documents; update as we build
