# VistaSign - Digital Signature Platform

A standalone digital signature platform for secure document signing and management.

## Features

- **Document Upload & Management**: Upload PDFs and other documents for signing
- **Digital Signatures**: Secure digital signature creation and application
- **Signature Templates**: Pre-configured signature templates for different use cases
- **Document Workflow**: Multi-step signing workflows with approval processes
- **Audit Trail**: Complete audit trail of all signature activities
- **Security**: End-to-end encryption and secure storage
- **API Integration**: RESTful API for third-party integrations

## Technology Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React with TypeScript
- **Database**: PostgreSQL
- **Authentication**: JWT with OAuth2
- **File Storage**: Secure cloud storage
- **Encryption**: AES-256 encryption for sensitive data

## Project Structure

```
VistaSign/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── core/           # Core configuration
│   │   ├── models/         # Database models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utilities
│   ├── requirements.txt
│   └── main.py
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── utils/          # Utilities
│   ├── package.json
│   └── public/
├── docs/                   # Documentation
├── tests/                  # Test files
└── docker/                 # Docker configuration
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Docker (optional)

### Installation

1. **Backend Setup**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm start
   ```

3. **Database Setup**:
   ```bash
   # Create database
   createdb vistasign
   
   # Run migrations
   python backend/manage.py migrate
   ```

### Development

- Backend runs on: `http://localhost:8000`
- Frontend runs on: `http://localhost:3000`
- API Documentation: `http://localhost:8000/docs`

## Features Overview

### Core Functionality
- Document upload and management
- Digital signature creation and application
- Multi-party signing workflows
- Signature verification and validation
- Document versioning and history

### Security Features
- End-to-end encryption
- Secure key management
- Audit logging
- Compliance with digital signature standards
- Multi-factor authentication

### Integration Features
- RESTful API
- Webhook support
- Third-party integrations
- Custom signature workflows
- Bulk operations

## License

Proprietary - VistaSign Platform
