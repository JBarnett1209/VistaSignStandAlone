"""
Create envelopes, recipients, fields, field_values, audit_events, sign_links

Revision ID: 004_envelopes_core
Revises: 003_add_field_id_to_signatures
Create Date: 2025-10-14
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '004_envelopes_core'
down_revision = '003_add_field_id_to_signatures'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'envelopes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), index=True, nullable=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('documents.id'), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('signing_order', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='DRAFT'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'recipients',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('envelope_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('envelopes.id'), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False, server_default='SIGNER'),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('routing_order', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('access_code_hash', sa.String(length=255), nullable=True),
        sa.Column('phone_mfa', sa.String(length=32), nullable=True),
    )
    op.create_index('ix_recipients_envelope_id', 'recipients', ['envelope_id'])
    op.create_index('ix_recipients_email', 'recipients', ['email'])

    op.create_table(
        'fields',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('envelope_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('envelopes.id'), nullable=False),
        sa.Column('recipient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('recipients.id'), nullable=True),
        sa.Column('page', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('rect', sa.JSON(), nullable=False),
        sa.Column('required', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('tab_settings', sa.JSON(), nullable=True),
    )
    op.create_index('ix_fields_envelope_id', 'fields', ['envelope_id'])

    op.create_table(
        'field_values',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('field_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('fields.id'), nullable=False),
        sa.Column('recipient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('recipients.id'), nullable=True),
        sa.Column('value', sa.JSON(), nullable=True),
        sa.Column('signed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('signer_ip', sa.String(length=64), nullable=True),
        sa.Column('signer_user_agent', sa.String(length=255), nullable=True),
        sa.Column('evidence_hash', sa.String(length=128), nullable=True),
    )
    op.create_index('ix_field_values_field_id', 'field_values', ['field_id'])
    op.create_index('ix_field_values_recipient_id', 'field_values', ['recipient_id'])

    op.create_table(
        'audit_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('envelope_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('envelopes.id'), nullable=False),
        sa.Column('actor_type', sa.String(length=20), nullable=False),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('event', sa.String(length=64), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('ix_audit_events_envelope_id', 'audit_events', ['envelope_id'])

    op.create_table(
        'sign_links',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('envelope_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('envelopes.id'), nullable=False),
        sa.Column('recipient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('recipients.id'), nullable=False),
        sa.Column('token_jti', sa.String(length=64), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_sign_links_envelope_id', 'sign_links', ['envelope_id'])
    op.create_index('ix_sign_links_recipient_id', 'sign_links', ['recipient_id'])


def downgrade() -> None:
    op.drop_table('sign_links')
    op.drop_table('audit_events')
    op.drop_table('field_values')
    op.drop_table('fields')
    op.drop_table('recipients')
    op.drop_table('envelopes')


