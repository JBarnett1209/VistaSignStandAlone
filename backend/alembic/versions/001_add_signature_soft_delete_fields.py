"""Add soft delete and admin fields to signatures

Revision ID: 001_signature_fields
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_signature_fields'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add cryptographic signature data fields
    op.add_column('signatures', sa.Column('digital_signature', sa.Text(), nullable=True))
    op.add_column('signatures', sa.Column('document_hash', sa.String(length=64), nullable=True))
    op.add_column('signatures', sa.Column('signature_metadata', sa.JSON(), nullable=True))
    op.add_column('signatures', sa.Column('verification_status', sa.String(length=20), nullable=True, server_default='pending'))
    
    # Add legal compliance fields
    op.add_column('signatures', sa.Column('signature_level', sa.String(length=20), nullable=True, server_default='simple'))
    op.add_column('signatures', sa.Column('is_legally_binding', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('signatures', sa.Column('compliance_standard', sa.String(length=20), nullable=True, server_default='ESIGN'))
    op.add_column('signatures', sa.Column('certificate_chain', sa.JSON(), nullable=True))
    op.add_column('signatures', sa.Column('timestamp_data', sa.JSON(), nullable=True))
    op.add_column('signatures', sa.Column('legal_metadata', sa.JSON(), nullable=True))
    
    # Add soft delete fields to signatures table
    op.add_column('signatures', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('signatures', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('signatures', sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('signatures', sa.Column('deletion_reason', sa.Text(), nullable=True))
    
    # Add hybrid signature fields
    op.add_column('signatures', sa.Column('certificate_type', sa.String(length=20), nullable=True, server_default='system'))
    op.add_column('signatures', sa.Column('user_metadata', sa.JSON(), nullable=True))
    op.add_column('signatures', sa.Column('qualified_metadata', sa.JSON(), nullable=True))
    
    # Add foreign key constraint for deleted_by
    op.create_foreign_key('fk_signatures_deleted_by_users', 'signatures', 'users', ['deleted_by'], ['id'])


def downgrade():
    # Remove foreign key constraint
    op.drop_constraint('fk_signatures_deleted_by_users', 'signatures', type_='foreignkey')
    
    # Remove hybrid signature fields
    op.drop_column('signatures', 'qualified_metadata')
    op.drop_column('signatures', 'user_metadata')
    op.drop_column('signatures', 'certificate_type')
    
    # Remove soft delete fields
    op.drop_column('signatures', 'deletion_reason')
    op.drop_column('signatures', 'deleted_by')
    op.drop_column('signatures', 'deleted_at')
    op.drop_column('signatures', 'is_deleted')
    
    # Remove legal compliance fields
    op.drop_column('signatures', 'legal_metadata')
    op.drop_column('signatures', 'timestamp_data')
    op.drop_column('signatures', 'certificate_chain')
    op.drop_column('signatures', 'compliance_standard')
    op.drop_column('signatures', 'is_legally_binding')
    op.drop_column('signatures', 'signature_level')
    
    # Remove cryptographic signature data fields
    op.drop_column('signatures', 'verification_status')
    op.drop_column('signatures', 'signature_metadata')
    op.drop_column('signatures', 'document_hash')
    op.drop_column('signatures', 'digital_signature')
