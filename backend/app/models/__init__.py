"""
VistaSign Database Models
"""

# Import all models to ensure they're registered with SQLAlchemy
from .user import User
from .document import Document, DocumentVersion
from .signature import Signature, SignatureTemplate
from .workflow import Workflow, WorkflowStep, WorkflowParticipant
from .invite import Invite
from .public_signing import PublicDocument, PublicSigningRecipient, PublicSignature, Organization
from .subscription import Subscription, Payment, UsageTracking
# Needed so `import app.models` fully resolves the registry (e.g. User.api_tokens).
# Previously only init_db() imported these, so importing app.models on its own
# (a worker, a script) left the User<->ApiToken mapper unresolvable.
from .api_token import ApiToken
from .log import ApplicationLog
from .contact import Contact
# Recipient, Field, FieldValue, AuditEvent, and SignLink are defined in envelope.py.
# The standalone modules (recipient.py, field.py, field_value.py, audit_event.py,
# sign_link.py) define the SAME tables and collide in SQLAlchemy's MetaData, so they
# must NOT be imported. Import the canonical definitions from envelope instead.
from .envelope import Envelope, Recipient, Field, FieldValue, AuditEvent, SignLink
