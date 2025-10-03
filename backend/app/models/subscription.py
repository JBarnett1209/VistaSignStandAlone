"""
VistaSign Subscription and Billing Models
"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Enum, Text, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from app.core.database import Base

class SubscriptionTier(str, PyEnum):
    """Subscription tiers"""
    FREE = "free"
    BASIC = "basic"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"

class SubscriptionStatus(str, PyEnum):
    """Subscription status"""
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    TRIAL = "trial"

class PaymentStatus(str, PyEnum):
    """Payment status"""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class Subscription(Base):
    """User subscription model"""
    __tablename__ = "subscriptions"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Subscription information
    tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.FREE)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE)
    
    # Billing information
    price_monthly = Column(Numeric(10, 2), default=0.00)
    price_yearly = Column(Numeric(10, 2), default=0.00)
    currency = Column(String(3), default="USD")
    
    # Limits and features
    max_documents_per_month = Column(Integer, default=5)  # Free tier limit
    max_signatures_per_month = Column(Integer, default=10)
    max_workflows_per_month = Column(Integer, default=2)
    max_storage_gb = Column(Integer, default=1)  # 1GB for free tier
    max_team_members = Column(Integer, default=1)
    
    # Features enabled
    advanced_analytics = Column(Boolean, default=False)
    custom_branding = Column(Boolean, default=False)
    api_access = Column(Boolean, default=False)
    priority_support = Column(Boolean, default=False)
    bulk_operations = Column(Boolean, default=False)
    advanced_workflows = Column(Boolean, default=False)
    
    # Trial information
    trial_start = Column(DateTime(timezone=True), nullable=True)
    trial_end = Column(DateTime(timezone=True), nullable=True)
    trial_days = Column(Integer, default=14)
    
    # Billing cycle
    billing_cycle = Column(String(20), default="monthly")  # monthly, yearly
    next_billing_date = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="subscription")
    payments = relationship("Payment", back_populates="subscription")
    
    def __repr__(self):
        return f"<Subscription(id={self.id}, tier='{self.tier.value}', status='{self.status.value}')>"
    
    @property
    def is_trial_active(self):
        """Check if trial is currently active"""
        if not self.trial_start or not self.trial_end:
            return False
        return datetime.utcnow() < self.trial_end
    
    @property
    def is_premium(self):
        """Check if user has premium features"""
        return self.tier != SubscriptionTier.FREE

class Payment(Base):
    """Payment records"""
    __tablename__ = "payments"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Payment information
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="USD")
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    
    # Payment provider information
    provider = Column(String(50), nullable=False)  # stripe, paypal, etc.
    provider_payment_id = Column(String(255), nullable=True)
    provider_customer_id = Column(String(255), nullable=True)
    
    # Billing period
    billing_period_start = Column(DateTime(timezone=True), nullable=False)
    billing_period_end = Column(DateTime(timezone=True), nullable=False)
    
    # Relationships
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    paid_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    subscription = relationship("Subscription", back_populates="payments")
    user = relationship("User")
    
    def __repr__(self):
        return f"<Payment(id={self.id}, amount={self.amount}, status='{self.status.value}')>"

class UsageTracking(Base):
    """Track usage against subscription limits"""
    __tablename__ = "usage_tracking"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Usage information
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False)
    
    # Monthly usage counters
    documents_uploaded = Column(Integer, default=0)
    signatures_created = Column(Integer, default=0)
    workflows_created = Column(Integer, default=0)
    storage_used_mb = Column(Integer, default=0)
    
    # Tracking period
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User")
    subscription = relationship("Subscription")
    
    def __repr__(self):
        return f"<UsageTracking(user_id={self.user_id}, month={self.month}/{self.year})>"
