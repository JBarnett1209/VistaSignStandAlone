# VistaSign System Flowcharts

## 1. Document Upload & Processing

```
User → /api/v1/documents/upload → FastAPI
           │
           └─> Store file locally → Generate UUID
                └─> Create Document record
                     └─> Return document_id
```

**Current Status**: ✅ Basic upload working, local storage only

## 2. Envelope Creation & Field Management

```
User → /api/v1/envelopes (POST) → Create envelope
           │
           └─> Add recipients & fields
                └─> POST /api/v1/envelopes/{id}/fields (bulk upsert)
                     └─> Store field definitions
```

**Current Status**: ✅ Full envelope management implemented

## 3. Document Editor (Drag & Drop)

```
User → /documents/{id}/edit → React Editor
           │
           └─> PDF.js canvas + @dnd-kit
                └─> Field palette → Drag to PDF
                     └─> Real-time field positioning
                          └─> Auto-save field definitions
```

**Current Status**: ✅ Working with @dnd-kit, PDF rendering

## 4. Public Signing Flow

```
Recipient → /api/v1/public/{envelope_id}/{recipient_id} → No auth required
           │
           └─> Load envelope + fields
                └─> POST /api/v1/public/{envelope_id}/{recipient_id}/fields/{field_id}
                     └─> Submit field values
                          └─> POST /api/v1/public/{envelope_id}/{recipient_id}/complete
                               └─> Mark recipient as completed
```

**Current Status**: ✅ Public API endpoints implemented

## 5. Real-time Updates (Socket.IO)

```
Client → /ws → Socket.IO connection
           │
           └─> Join room: envelope_{envelope_id}
                └─> Server emits:
                     ├─ field.updated
                     ├─ recipient.progress  
                     └─ envelope.status
```

**Current Status**: ✅ Socket.IO server running, real-time events

## 6. Envelope Finalization (Background Job)

```
Envelope sent → POST /api/v1/envelopes/{id}/send
           │
           └─> Enqueue finalize job
                └─> Background worker:
                     ├─ Flatten fields into PDF
                     ├─ Generate evidence JSON
                     ├─ Sign PDF with PKCS#12
                     └─ Store signed PDF + evidence
```

**Current Status**: ⚠️ Basic worker implemented, PDF flattening pending

## 7. Authentication & Security

```
User → /api/v1/auth/login → JWT tokens
           │
           └─> HttpOnly cookies + CSRF protection
                └─> Rate limiting (SlowAPI)
                     └─> Security headers (CSP, HSTS, etc.)
```

**Current Status**: ✅ JWT auth, CSRF, rate limiting, security headers

## 8. File Storage Architecture

```
Current: Local filesystem storage
Future:  S3-compatible storage with encryption
           │
           └─> Pluggable storage service
                └─> Pre-signed URLs for secure access
```

**Current Status**: ✅ Local storage working, S3 adapter ready

## API Endpoints Summary

### Authenticated Endpoints
- `/api/v1/documents/*` - Document management
- `/api/v1/envelopes/*` - Envelope management  
- `/api/v1/users/*` - User management
- `/api/v1/auth/*` - Authentication

### Public Endpoints (No Auth)
- `/api/v1/public/{envelope_id}/{recipient_id}` - Get signing data
- `/api/v1/public/{envelope_id}/{recipient_id}/document/pdf` - Get document PDF
- `/api/v1/public/{envelope_id}/{recipient_id}/fields/{field_id}` - Submit field values
- `/api/v1/public/{envelope_id}/{recipient_id}/complete` - Complete signing
- `/api/v1/public/{envelope_id}/{recipient_id}/decline` - Decline signing

### WebSocket
- `/ws` - Real-time updates for envelope progress
