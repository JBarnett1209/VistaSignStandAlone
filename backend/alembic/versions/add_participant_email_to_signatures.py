"""Add participant_email to signatures and make signer_id nullable

Revision ID: 002_add_participant_email_to_signatures
Revises: 001_add_signature_soft_delete_fields
Create Date: 2025-01-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_add_participant_email_to_signatures'
down_revision = '001_signature_fields'
branch_labels = None
depends_on = None


def upgrade():
    # Make signer_id nullable
    op.alter_column('signatures', 'signer_id',
                    existing_type=sa.UUID(),
                    nullable=True)
    
    # Add participant_email column
    op.add_column('signatures', sa.Column('participant_email', sa.String(255), nullable=True))


def downgrade():
    # Remove participant_email column
    op.drop_column('signatures', 'participant_email')
    
    # Make signer_id not nullable again (this might fail if there are NULL values)
    op.alter_column('signatures', 'signer_id',
                    existing_type=sa.UUID(),
                    nullable=False)
