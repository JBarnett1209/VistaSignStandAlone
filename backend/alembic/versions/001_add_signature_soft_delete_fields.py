"""Add soft delete and admin fields to signatures

Revision ID: 001_add_signature_soft_delete_fields
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_add_signature_soft_delete_fields'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
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
    
    # Remove columns
    op.drop_column('signatures', 'qualified_metadata')
    op.drop_column('signatures', 'user_metadata')
    op.drop_column('signatures', 'certificate_type')
    op.drop_column('signatures', 'deletion_reason')
    op.drop_column('signatures', 'deleted_by')
    op.drop_column('signatures', 'deleted_at')
    op.drop_column('signatures', 'is_deleted')
