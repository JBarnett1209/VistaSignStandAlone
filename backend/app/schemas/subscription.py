"""
VistaSign Subscription Schemas
"""

from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

class SubscriptionResponse(BaseModel):
    """Subscription response schema"""
    id: str
    tier: str
    status: str
    price_monthly: float
    price_yearly: float
    currency: str
    max_documents_per_month: int
    max_signatures_per_month: int
    max_workflows_per_month: int
    max_storage_gb: int
    max_team_members: int
    advanced_analytics: bool
    custom_branding: bool
    api_access: bool
    priority_support: bool
    bulk_operations: bool
    advanced_workflows: bool
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    trial_days: int
    billing_cycle: str
    next_billing_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class SubscriptionUpdate(BaseModel):
    """Subscription update schema"""
    tier: Optional[str] = None
    billing_cycle: Optional[str] = None

class PaymentResponse(BaseModel):
    """Payment response schema"""
    id: str
    amount: float
    currency: str
    status: str
    provider: str
    billing_period_start: datetime
    billing_period_end: datetime
    created_at: datetime
    paid_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UsageTrackingResponse(BaseModel):
    """Usage tracking response schema"""
    id: str
    documents_uploaded: int
    signatures_created: int
    workflows_created: int
    storage_used_mb: int
    year: int
    month: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class BillingInfoResponse(BaseModel):
    """Billing info response schema"""
    subscription_tier: str
    next_billing_date: Optional[datetime] = None
    billing_cycle: str
    next_payment_amount: float
    currency: str
    is_trial_active: bool
    trial_end: Optional[datetime] = None
