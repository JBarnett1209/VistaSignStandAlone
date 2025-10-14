# VistaSign System Architecture

## Overview

VistaSign is a modern, secure digital signature platform built with FastAPI and React, designed to provide DocuSign-like functionality with enterprise-grade security and compliance.

## Technology Stack

### Backend
- **FastAPI** - Modern Python web framework with automatic API documentation
- **PostgreSQL** - Primary database for all application data
- **Redis** - Caching and background job queue
- **SQLAlchemy** - ORM with async support
- **Alembic** - Database migrations
- **Socket.IO** - Real-time communication
- **JWT** - Authentication tokens
- **PyHanko** - PDF digital signatures (PAdES)

### Frontend
- **React 18** - Modern UI framework
- **Material-UI** - Component library
- **PDF.js** - PDF rendering and manipulation
- **@dnd-kit** - Modern drag and drop
- **Axios** - HTTP client
- **React Router** - Client-side routing

### Infrastructure
- **Docker & Docker Compose** - Containerization
- **Nginx** - Reverse proxy and static file serving
- **Let's Encrypt** - SSL certificates
- **AWS S3** - File storage (optional)

## System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React)       │◄──►│   (FastAPI)     │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx         │    │   Redis         │    │   File Storage  │
│   (Proxy)       │    │   (Cache/Queue) │    │   (Local/S3)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Features

### 1. Document Management
- Upload documents (PDF, DOCX, XLSX, PPTX, images)
- Automatic conversion to PDF
- Version control and audit trails
- Secure file storage with encryption

### 2. Envelope System
- Create signing envelopes with multiple recipients
- Define signing order and routing
- Add form fields (signature, text, checkboxes, etc.)
- Real-time status tracking

### 3. Document Editor
- Drag-and-drop field placement
- PDF.js canvas rendering
- Real-time field positioning
- Field validation and requirements

### 4. Public Signing
- No-authentication signing flow
- Secure token-based access
- Mobile-responsive interface
- Signature capture (draw, type, upload)

### 5. Real-time Updates
- Socket.IO for live collaboration
- Envelope status tracking
- Field completion notifications
- Progress indicators

### 6. Security & Compliance
- JWT authentication with refresh tokens
- CSRF protection
- Rate limiting
- Security headers (CSP, HSTS, etc.)
- Audit logging
- ESIGN/UETA compliance ready

## API Architecture

### Authentication Flow
```
1. POST /api/v1/auth/login → JWT tokens
2. HttpOnly cookies for session management
3. CSRF tokens for state-changing operations
4. Rate limiting on sensitive endpoints
```

### Public Signing Flow
```
1. GET /api/v1/public/{envelope_id}/{recipient_id} → Load signing data
2. GET /api/v1/public/{envelope_id}/{recipient_id}/document/pdf → Get document
3. POST /api/v1/public/{envelope_id}/{recipient_id}/fields/{field_id} → Submit values
4. POST /api/v1/public/{envelope_id}/{recipient_id}/complete → Complete signing
```

### Real-time Events
```
- field.updated → Field value changed
- recipient.progress → Recipient status updated
- envelope.status → Envelope status changed
```

## Security Model

### Authentication
- JWT access tokens (15 min expiry)
- JWT refresh tokens (7 day expiry)
- HttpOnly cookies for token storage
- CSRF protection for state-changing operations

### Authorization
- Role-based access control (Admin, User, Viewer)
- Tenant isolation (multi-tenant ready)
- Document ownership validation
- Envelope access control

### Data Protection
- AES-GCM encryption for sensitive data
- Secure file storage with access controls
- Audit trails for all operations
- IP and user agent logging

## Deployment Architecture

### Development
```
docker-compose up
├── nginx (frontend + proxy)
├── backend (FastAPI)
├── db (PostgreSQL)
└── redis (cache + queue)
```

### Production
```
Load Balancer (ALB)
├── Nginx (SSL termination + static files)
├── FastAPI (multiple instances)
├── PostgreSQL (primary + replica)
├── Redis (cluster)
└── S3 (file storage)
```

## Performance Considerations

### Caching Strategy
- Redis for session data and API responses
- Browser caching for static assets
- CDN for global content delivery

### Database Optimization
- Indexed queries for common operations
- Connection pooling
- Read replicas for scaling

### File Storage
- Local storage for development
- S3 with CloudFront for production
- Pre-signed URLs for secure access

## Monitoring & Observability

### Logging
- Structured logging with correlation IDs
- Database audit trails
- Security event logging
- Performance metrics

### Health Checks
- `/health` endpoint for load balancer
- Database connectivity checks
- Redis connectivity checks
- File storage accessibility

## Compliance & Legal

### ESIGN/UETA Compliance
- Audit trails for all signing events
- IP address and timestamp logging
- Document integrity verification
- Certificate of completion generation

### Data Privacy
- GDPR-ready data handling
- Right to deletion
- Data export capabilities
- Consent management

## Future Enhancements

### Planned Features
- Advanced workflow automation
- Template management
- Bulk operations
- Advanced analytics
- Mobile applications
- Third-party integrations

### Scalability
- Microservices architecture
- Event-driven processing
- Horizontal scaling
- Global deployment
