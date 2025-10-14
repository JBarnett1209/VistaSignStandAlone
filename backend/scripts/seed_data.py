"""
Seed script for VistaSign database
"""

import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db_session
from app.models.user import User, UserRole, UserStatus
from app.models.document import Document, DocumentStatus, DocumentType
from app.models.envelope import Envelope, EnvelopeStatus
from app.models.recipient import Recipient, RecipientRole, RecipientStatus
from app.models.field import Field, FieldType
from app.models.field_value import FieldValue
from app.models.audit_event import AuditEvent, ActorType
from app.core.security.auth import AuthHandler
from app.core.config import settings

# Initialize auth handler
auth_handler = AuthHandler()

async def create_test_users(db: AsyncSession):
    """Create test users"""
    users = []
    
    # Create admin user
    admin_user = User(
        id=uuid.uuid4(),
        email="admin@vistasign.com",
        password_hash=auth_handler.get_password_hash("admin123"),
        first_name="Admin",
        last_name="User",
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
        is_verified=True,
        is_active=True,
        company="VistaSign",
        job_title="System Administrator"
    )
    users.append(admin_user)
    db.add(admin_user)
    
    # Create regular user
    regular_user = User(
        id=uuid.uuid4(),
        email="user@vistasign.com",
        password_hash=auth_handler.get_password_hash("user123"),
        first_name="John",
        last_name="Doe",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        is_verified=True,
        is_active=True,
        company="Acme Corp",
        job_title="Manager"
    )
    users.append(regular_user)
    db.add(regular_user)
    
    # Create signer user
    signer_user = User(
        id=uuid.uuid4(),
        email="signer@vistasign.com",
        password_hash=auth_handler.get_password_hash("signer123"),
        first_name="Jane",
        last_name="Smith",
        role=UserRole.SIGNER,
        status=UserStatus.ACTIVE,
        is_verified=True,
        is_active=True,
        company="Smith & Associates",
        job_title="Legal Counsel"
    )
    users.append(signer_user)
    db.add(signer_user)
    
    await db.commit()
    return users

async def create_test_documents(db: AsyncSession, users):
    """Create test documents"""
    documents = []
    
    # Create sample documents for each user
    for user in users:
        for i in range(3):
            doc = Document(
                id=uuid.uuid4(),
                title=f"Test Document {i+1} - {user.first_name}",
                description=f"This is a test document created for {user.first_name} {user.last_name}",
                filename=f"test_document_{i+1}_{user.id}.pdf",
                file_path=f"/uploads/test_document_{i+1}_{user.id}.pdf",
                file_size=1024 * 100,  # 100KB
                file_hash=f"test_hash_{i+1}_{user.id}",
                document_type=DocumentType.PDF,
                status=DocumentStatus.DRAFT,
                mime_type="application/pdf",
                requires_signature=True,
                created_by=user.id,
                owner_id=user.id
            )
            documents.append(doc)
            db.add(doc)
    
    await db.commit()
    return documents

async def create_test_envelopes(db: AsyncSession, users, documents):
    """Create test envelopes"""
    envelopes = []
    
    # Create envelopes for each user
    for user in users:
        for i, doc in enumerate(documents):
            if doc.owner_id == user.id:
                envelope = Envelope(
                    id=uuid.uuid4(),
                    tenant_id=user.id,
                    document_id=doc.id,
                    subject=f"Please sign: {doc.title}",
                    message=f"Please review and sign the attached document: {doc.title}",
                    status=EnvelopeStatus.DRAFT,
                    created_by=user.id
                )
                envelopes.append(envelope)
                db.add(envelope)
                
                # Create audit event
                audit_event = AuditEvent(
                    id=uuid.uuid4(),
                    envelope_id=envelope.id,
                    actor_type=ActorType.USER,
                    actor_id=user.id,
                    event="envelope.created",
                    event_metadata={"subject": envelope.subject}
                )
                db.add(audit_event)
    
    await db.commit()
    return envelopes

async def create_test_recipients(db: AsyncSession, envelopes, users):
    """Create test recipients"""
    recipients = []
    
    for envelope in envelopes:
        # Create 2-3 recipients per envelope
        for i in range(2):
            recipient = Recipient(
                id=uuid.uuid4(),
                envelope_id=envelope.id,
                role=RecipientRole.SIGNER,
                name=f"Recipient {i+1}",
                email=f"recipient{i+1}@example.com",
                routing_order=i+1,
                status=RecipientStatus.PENDING
            )
            recipients.append(recipient)
            db.add(recipient)
    
    await db.commit()
    return recipients

async def create_test_fields(db: AsyncSession, envelopes, recipients):
    """Create test fields"""
    fields = []
    
    for envelope in envelopes:
        # Create signature field
        signature_field = Field(
            id=uuid.uuid4(),
            envelope_id=envelope.id,
            page_index=0,
            type=FieldType.SIGNATURE,
            rect_pts={"x": 100, "y": 100, "w": 200, "h": 50},
            rotation=0,
            required=True,
            recipient_id=recipients[0].id if recipients else None
        )
        fields.append(signature_field)
        db.add(signature_field)
        
        # Create text field
        text_field = Field(
            id=uuid.uuid4(),
            envelope_id=envelope.id,
            page_index=0,
            type=FieldType.TEXT,
            rect_pts={"x": 100, "y": 200, "w": 150, "h": 30},
            rotation=0,
            required=False,
            recipient_id=recipients[0].id if recipients else None
        )
        fields.append(text_field)
        db.add(text_field)
        
        # Create date field
        date_field = Field(
            id=uuid.uuid4(),
            envelope_id=envelope.id,
            page_index=0,
            type=FieldType.DATE_SIGNED,
            rect_pts={"x": 100, "y": 300, "w": 120, "h": 30},
            rotation=0,
            required=True,
            recipient_id=recipients[0].id if recipients else None
        )
        fields.append(date_field)
        db.add(date_field)
    
    await db.commit()
    return fields

async def create_test_field_values(db: AsyncSession, fields, recipients):
    """Create test field values"""
    field_values = []
    
    for field in fields:
        if field.recipient_id:
            field_value = FieldValue(
                id=uuid.uuid4(),
                field_id=field.id,
                recipient_id=field.recipient_id,
                envelope_id=field.envelope_id,
                value="Test value" if field.type == FieldType.TEXT else None,
                signed_at=datetime.now(timezone.utc),
                signer_ip="127.0.0.1",
                signer_user_agent="Test User Agent",
                evidence_hash="test_hash"
            )
            field_values.append(field_value)
            db.add(field_value)
    
    await db.commit()
    return field_values

async def main():
    """Main seed function"""
    print("🌱 Starting VistaSign database seeding...")
    
    async with get_db_session() as db:
        try:
            # Create test data
            print("👥 Creating test users...")
            users = await create_test_users(db)
            print(f"✅ Created {len(users)} users")
            
            print("📄 Creating test documents...")
            documents = await create_test_documents(db, users)
            print(f"✅ Created {len(documents)} documents")
            
            print("📮 Creating test envelopes...")
            envelopes = await create_test_envelopes(db, users, documents)
            print(f"✅ Created {len(envelopes)} envelopes")
            
            print("👤 Creating test recipients...")
            recipients = await create_test_recipients(db, envelopes, users)
            print(f"✅ Created {len(recipients)} recipients")
            
            print("📝 Creating test fields...")
            fields = await create_test_fields(db, envelopes, recipients)
            print(f"✅ Created {len(fields)} fields")
            
            print("✍️ Creating test field values...")
            field_values = await create_test_field_values(db, fields, recipients)
            print(f"✅ Created {len(field_values)} field values")
            
            print("🎉 Database seeding completed successfully!")
            print("\n📋 Test Data Summary:")
            print(f"   Users: {len(users)}")
            print(f"   Documents: {len(documents)}")
            print(f"   Envelopes: {len(envelopes)}")
            print(f"   Recipients: {len(recipients)}")
            print(f"   Fields: {len(fields)}")
            print(f"   Field Values: {len(field_values)}")
            
            print("\n🔑 Test User Credentials:")
            print("   Admin: admin@vistasign.com / admin123")
            print("   User: user@vistasign.com / user123")
            print("   Signer: signer@vistasign.com / signer123")
            
        except Exception as e:
            print(f"❌ Error during seeding: {e}")
            await db.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(main())
