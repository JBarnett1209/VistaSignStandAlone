"""
VistaSign Billing and Subscription API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
import logging
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security.auth import get_current_user
from app.models.subscription import Subscription, Payment, UsageTracking, SubscriptionTier, SubscriptionStatus
from app.schemas.subscription import (
    SubscriptionResponse, SubscriptionUpdate, PaymentResponse,
    UsageTrackingResponse, BillingInfoResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get user's current subscription"""
    try:
        result = await db.execute(
            select(Subscription).where(Subscription.user_id == current_user["user_id"])
        )
        subscription = result.scalar_one_or_none()
        
        if not subscription:
            # Create free subscription if none exists
            subscription = Subscription(
                user_id=current_user["user_id"],
                tier=SubscriptionTier.FREE
            )
            db.add(subscription)
            await db.commit()
            await db.refresh(subscription)
        
        return SubscriptionResponse(
            id=str(subscription.id),
            tier=subscription.tier.value,
            status=subscription.status.value,
            price_monthly=float(subscription.price_monthly),
            price_yearly=float(subscription.price_yearly),
            currency=subscription.currency,
            max_documents_per_month=subscription.max_documents_per_month,
            max_signatures_per_month=subscription.max_signatures_per_month,
            max_workflows_per_month=subscription.max_workflows_per_month,
            max_storage_gb=subscription.max_storage_gb,
            max_team_members=subscription.max_team_members,
            advanced_analytics=subscription.advanced_analytics,
            custom_branding=subscription.custom_branding,
            api_access=subscription.api_access,
            priority_support=subscription.priority_support,
            bulk_operations=subscription.bulk_operations,
            advanced_workflows=subscription.advanced_workflows,
            trial_start=subscription.trial_start,
            trial_end=subscription.trial_end,
            trial_days=subscription.trial_days,
            billing_cycle=subscription.billing_cycle,
            next_billing_date=subscription.next_billing_date,
            created_at=subscription.created_at,
            updated_at=subscription.updated_at
        )
        
    except Exception as e:
        logger.error(f"Get subscription error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get subscription"
        )

@router.put("/subscription", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_update: SubscriptionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update subscription (upgrade/downgrade)"""
    try:
        result = await db.execute(
            select(Subscription).where(Subscription.user_id == current_user["user_id"])
        )
        subscription = result.scalar_one_or_none()
        
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription not found"
            )
        
        # Update subscription tier and features
        if subscription_update.tier:
            subscription.tier = SubscriptionTier(subscription_update.tier)
            
            # Update limits based on tier
            if subscription.tier == SubscriptionTier.FREE:
                subscription.max_documents_per_month = 5
                subscription.max_signatures_per_month = 10
                subscription.max_workflows_per_month = 2
                subscription.max_storage_gb = 1
                subscription.max_team_members = 1
                subscription.price_monthly = 0.00
                subscription.price_yearly = 0.00
            elif subscription.tier == SubscriptionTier.BASIC:
                subscription.max_documents_per_month = 50
                subscription.max_signatures_per_month = 100
                subscription.max_workflows_per_month = 10
                subscription.max_storage_gb = 10
                subscription.max_team_members = 5
                subscription.price_monthly = 9.99
                subscription.price_yearly = 99.99
                subscription.custom_branding = True
            elif subscription.tier == SubscriptionTier.PROFESSIONAL:
                subscription.max_documents_per_month = -1  # Unlimited
                subscription.max_signatures_per_month = -1
                subscription.max_workflows_per_month = -1
                subscription.max_storage_gb = 100
                subscription.max_team_members = 25
                subscription.price_monthly = 29.99
                subscription.price_yearly = 299.99
                subscription.advanced_analytics = True
                subscription.custom_branding = True
                subscription.api_access = True
                subscription.priority_support = True
                subscription.bulk_operations = True
                subscription.advanced_workflows = True
            elif subscription.tier == SubscriptionTier.ENTERPRISE:
                subscription.max_documents_per_month = -1
                subscription.max_signatures_per_month = -1
                subscription.max_workflows_per_month = -1
                subscription.max_storage_gb = -1
                subscription.max_team_members = -1
                subscription.price_monthly = 99.99
                subscription.price_yearly = 999.99
                subscription.advanced_analytics = True
                subscription.custom_branding = True
                subscription.api_access = True
                subscription.priority_support = True
                subscription.bulk_operations = True
                subscription.advanced_workflows = True
        
        if subscription_update.billing_cycle:
            subscription.billing_cycle = subscription_update.billing_cycle
        
        # Set next billing date
        if subscription.tier != SubscriptionTier.FREE:
            if subscription.billing_cycle == "monthly":
                subscription.next_billing_date = datetime.utcnow() + timedelta(days=30)
            else:
                subscription.next_billing_date = datetime.utcnow() + timedelta(days=365)
        
        await db.commit()
        await db.refresh(subscription)
        
        return SubscriptionResponse(
            id=str(subscription.id),
            tier=subscription.tier.value,
            status=subscription.status.value,
            price_monthly=float(subscription.price_monthly),
            price_yearly=float(subscription.price_yearly),
            currency=subscription.currency,
            max_documents_per_month=subscription.max_documents_per_month,
            max_signatures_per_month=subscription.max_signatures_per_month,
            max_workflows_per_month=subscription.max_workflows_per_month,
            max_storage_gb=subscription.max_storage_gb,
            max_team_members=subscription.max_team_members,
            advanced_analytics=subscription.advanced_analytics,
            custom_branding=subscription.custom_branding,
            api_access=subscription.api_access,
            priority_support=subscription.priority_support,
            bulk_operations=subscription.bulk_operations,
            advanced_workflows=subscription.advanced_workflows,
            trial_start=subscription.trial_start,
            trial_end=subscription.trial_end,
            trial_days=subscription.trial_days,
            billing_cycle=subscription.billing_cycle,
            next_billing_date=subscription.next_billing_date,
            created_at=subscription.created_at,
            updated_at=subscription.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update subscription error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update subscription"
        )

@router.get("/usage", response_model=UsageTrackingResponse)
async def get_usage_tracking(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get current month's usage tracking"""
    try:
        current_month = datetime.utcnow().month
        current_year = datetime.utcnow().year
        
        result = await db.execute(
            select(UsageTracking).where(
                and_(
                    UsageTracking.user_id == current_user["user_id"],
                    UsageTracking.year == current_year,
                    UsageTracking.month == current_month
                )
            )
        )
        usage = result.scalar_one_or_none()
        
        if not usage:
            # Get user's subscription to create usage tracking
            subscription_result = await db.execute(
                select(Subscription).where(Subscription.user_id == current_user["user_id"])
            )
            subscription = subscription_result.scalar_one_or_none()
            
            if not subscription:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Subscription not found"
                )
            
            usage = UsageTracking(
                user_id=current_user["user_id"],
                subscription_id=subscription.id,
                year=current_year,
                month=current_month
            )
            db.add(usage)
            await db.commit()
            await db.refresh(usage)
        
        return UsageTrackingResponse(
            id=str(usage.id),
            documents_uploaded=usage.documents_uploaded,
            signatures_created=usage.signatures_created,
            workflows_created=usage.workflows_created,
            storage_used_mb=usage.storage_used_mb,
            year=usage.year,
            month=usage.month,
            created_at=usage.created_at,
            updated_at=usage.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get usage tracking error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get usage tracking"
        )

@router.get("/payments", response_model=List[PaymentResponse])
async def get_payment_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get payment history"""
    try:
        result = await db.execute(
            select(Payment).where(Payment.user_id == current_user["user_id"])
            .order_by(Payment.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        payments = result.scalars().all()
        
        return [
            PaymentResponse(
                id=str(payment.id),
                amount=float(payment.amount),
                currency=payment.currency,
                status=payment.status.value,
                provider=payment.provider,
                billing_period_start=payment.billing_period_start,
                billing_period_end=payment.billing_period_end,
                created_at=payment.created_at,
                paid_at=payment.paid_at
            ) for payment in payments
        ]
        
    except Exception as e:
        logger.error(f"Get payment history error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payment history"
        )

@router.get("/billing-info", response_model=BillingInfoResponse)
async def get_billing_info(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get billing information and next payment"""
    try:
        # Get subscription
        subscription_result = await db.execute(
            select(Subscription).where(Subscription.user_id == current_user["user_id"])
        )
        subscription = subscription_result.scalar_one_or_none()
        
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription not found"
            )
        
        # Get next payment
        next_payment_result = await db.execute(
            select(Payment).where(
                and_(
                    Payment.user_id == current_user["user_id"],
                    Payment.status == "pending"
                )
            ).order_by(Payment.created_at.desc()).limit(1)
        )
        next_payment = next_payment_result.scalar_one_or_none()
        
        return BillingInfoResponse(
            subscription_tier=subscription.tier.value,
            next_billing_date=subscription.next_billing_date,
            billing_cycle=subscription.billing_cycle,
            next_payment_amount=float(next_payment.amount) if next_payment else 0.0,
            currency=subscription.currency,
            is_trial_active=subscription.is_trial_active,
            trial_end=subscription.trial_end
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get billing info error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get billing info"
        )
