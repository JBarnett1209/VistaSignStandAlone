"""Add field_id to signatures

Revision ID: 003_field_id
Revises: 002_participant_email
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_field_id'
down_revision = '002_participant_email'
branch_labels = None
depends_on = None


def upgrade():
    # Add field_id column to signatures table
    op.add_column('signatures', sa.Column('field_id', sa.String(255), nullable=True))


def downgrade():
    # Remove field_id column from signatures table
    op.drop_column('signatures', 'field_id')
