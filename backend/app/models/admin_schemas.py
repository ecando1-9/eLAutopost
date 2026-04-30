"""
Admin-specific Pydantic models.

Models for admin API requests and responses.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from ..core.security import sanitize_input


# =============================================================================
# ENUMS
# =============================================================================

class UserRole(str, Enum):
    """User role enum."""
    ADMIN = "admin"
    USER = "user"


class SubscriptionStatus(str, Enum):
    """Subscription status enum."""
    TRIAL = "trial"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    BLOCKED = "blocked"


class AdminAction(str, Enum):
    """Admin action types for audit logging."""
    USER_BLOCKED = "user_blocked"
    USER_UNBLOCKED = "user_unblocked"
    USER_SUSPENDED = "user_suspended"
    USER_RESUMED = "user_resumed"
    TRIAL_EXTENDED = "trial_extended"
    SUBSCRIPTION_ACTIVATED = "subscription_activated"
    SUBSCRIPTION_CANCELLED = "subscription_cancelled"
    SUBSCRIPTION_ON_HOLD = "subscription_on_hold"
    SUBSCRIPTION_RESUMED = "subscription_resumed"
    USAGE_RESET = "usage_reset"
    ROLE_CHANGED = "role_changed"
    BILLING_PLAN_UPDATED = "billing_plan_updated"
    BILLING_COUPON_CREATED = "billing_coupon_created"
    BILLING_COUPON_UPDATED = "billing_coupon_updated"


# =============================================================================
# USER MANAGEMENT MODELS
# =============================================================================

class AdminUserResponse(BaseModel):
    """Admin view of user data."""
    id: str
    email: str
    full_name: str
    signup_date: datetime
    last_login_at: Optional[datetime]
    role: UserRole
    subscription_status: SubscriptionStatus
    trial_start: Optional[datetime]
    trial_end: Optional[datetime]
    subscription_start: Optional[datetime]
    renewal_date: Optional[datetime]
    price: float
    posts_generated: int = 0
    images_generated: int = 0
    linkedin_posts: int = 0
    api_calls: int = 0
    last_activity: Optional[datetime]
    status_label: str
    automation: Optional[Dict[str, Any]] = None


class BlockUserRequest(BaseModel):
    """Request to block a user."""
    user_id: str = Field(..., description="User ID to block")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for blocking")
    
    @validator("reason")
    def sanitize_reason(cls, v):
        """Sanitize reason text."""
        if v:
            return sanitize_input(v, max_length=500)
        return v


class UnblockUserRequest(BaseModel):
    """Request to unblock a user."""
    user_id: str = Field(..., description="User ID to unblock")


class SuspendUserRequest(BaseModel):
    """Request to suspend a user."""
    user_id: str = Field(..., description="User ID to suspend")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for suspension")

    @validator("reason")
    def sanitize_suspend_reason(cls, v):
        """Sanitize suspension reason text."""
        if v:
            return sanitize_input(v, max_length=500)
        return v


class ResumeUserRequest(BaseModel):
    """Request to resume a suspended user."""
    user_id: str = Field(..., description="User ID to resume")


# =============================================================================
# SUBSCRIPTION MANAGEMENT MODELS
# =============================================================================

class SubscriptionResponse(BaseModel):
    """Subscription data response."""
    id: str
    user_id: str
    plan_name: str
    price: float
    currency: str
    status: SubscriptionStatus
    trial_start: Optional[datetime]
    trial_end: Optional[datetime]
    subscription_start: Optional[datetime]
    renewal_date: Optional[datetime]
    last_payment_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class ExtendTrialRequest(BaseModel):
    """Request to extend user's trial."""
    user_id: str = Field(..., description="User ID")
    days: int = Field(..., ge=1, le=365, description="Number of days to extend (1-365)")


class ActivateSubscriptionRequest(BaseModel):
    """Request to manually activate subscription."""
    user_id: str = Field(..., description="User ID")


class CancelSubscriptionRequest(BaseModel):
    """Request to cancel subscription."""
    user_id: str = Field(..., description="User ID")


class HoldSubscriptionRequest(BaseModel):
    """Request to place subscription on hold."""
    user_id: str = Field(..., description="User ID")
    reason: Optional[str] = Field(None, max_length=500, description="Optional hold reason")

    @validator("reason")
    def sanitize_hold_reason(cls, v):
        """Sanitize hold reason text."""
        if v:
            return sanitize_input(v, max_length=500)
        return v


class ResumeSubscriptionRequest(BaseModel):
    """Request to resume a held/cancelled subscription."""
    user_id: str = Field(..., description="User ID")


class BillingPlanAdminResponse(BaseModel):
    """Editable billing plan returned to admins."""
    plan_name: str
    display_name: str
    amount_paise: int
    currency: str
    billing_period_days: int
    checkout_description: Optional[str] = None
    is_active: bool = True


class UpdateBillingPlanRequest(BaseModel):
    """Request to update the active billing plan."""
    plan_name: str = Field(default="pro", max_length=50)
    display_name: str = Field(..., min_length=2, max_length=100)
    amount_paise: int = Field(..., ge=100)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    billing_period_days: int = Field(default=30, ge=1, le=365)
    checkout_description: Optional[str] = Field(default=None, max_length=300)

    @validator("plan_name", "display_name", "currency", "checkout_description")
    def sanitize_plan_fields(cls, v):
        if isinstance(v, str):
            return sanitize_input(v, max_length=300).strip()
        return v


class BillingCouponResponse(BaseModel):
    """Admin coupon response."""
    id: str
    code: str
    description: Optional[str] = None
    discount_type: str
    discount_value: int
    max_redemptions: Optional[int] = None
    redeemed_count: int = 0
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CreateBillingCouponRequest(BaseModel):
    """Request to create a checkout coupon."""
    code: str = Field(..., min_length=2, max_length=40)
    description: Optional[str] = Field(default=None, max_length=300)
    discount_type: str = Field(..., pattern="^(percent|fixed)$")
    discount_value: int = Field(..., ge=1)
    max_redemptions: Optional[int] = Field(default=None, ge=1)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = True

    @validator("code")
    def sanitize_coupon_code(cls, v):
        return sanitize_input(v, max_length=40).strip().upper()

    @validator("description")
    def sanitize_coupon_description(cls, v):
        if v:
            return sanitize_input(v, max_length=300).strip()
        return v


class UpdateBillingCouponRequest(BaseModel):
    """Request to update a coupon."""
    description: Optional[str] = Field(default=None, max_length=300)
    discount_type: Optional[str] = Field(default=None, pattern="^(percent|fixed)$")
    discount_value: Optional[int] = Field(default=None, ge=1)
    max_redemptions: Optional[int] = Field(default=None, ge=1)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: Optional[bool] = None

    @validator("description")
    def sanitize_update_description(cls, v):
        if v:
            return sanitize_input(v, max_length=300).strip()
        return v


# =============================================================================
# USAGE TRACKING MODELS
# =============================================================================

class UsageMetricsResponse(BaseModel):
    """Usage metrics response."""
    id: str
    user_id: str
    posts_generated: int
    images_generated: int
    linkedin_posts: int
    api_calls: int
    last_activity: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class ResetUsageRequest(BaseModel):
    """Request to reset user usage."""
    user_id: str = Field(..., description="User ID")


# =============================================================================
# ANALYTICS MODELS
# =============================================================================

class DashboardStatsResponse(BaseModel):
    """Admin dashboard statistics."""
    total_users: int
    active_subscribers: int
    trial_users: int
    expired_trials: int
    blocked_users: int
    mrr: float  # Monthly Recurring Revenue
    new_users_this_month: int
    new_subscribers_this_month: int


class RevenueAnalyticsResponse(BaseModel):
    """Revenue analytics by month."""
    month: datetime
    new_subscriptions: int
    revenue: float
    mrr_added: float


class UsageAnalyticsResponse(BaseModel):
    """Usage analytics by day."""
    date: datetime
    active_users: int
    total_posts: int
    total_images: int
    total_linkedin_posts: int
    total_api_calls: int


# =============================================================================
# AUDIT LOG MODELS
# =============================================================================

class AuditLogResponse(BaseModel):
    """Audit log entry."""
    id: str
    admin_id: str
    action: str
    target_user_id: Optional[str]
    details: dict
    ip_address: Optional[str]
    created_at: datetime


class AuditLogFilter(BaseModel):
    """Filters for audit log queries."""
    admin_id: Optional[str] = None
    action: Optional[AdminAction] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


# =============================================================================
# PAGINATION MODELS
# =============================================================================

class AdminPaginatedUsersResponse(BaseModel):
    """Paginated users response."""
    users: List[AdminUserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AdminPaginatedLogsResponse(BaseModel):
    """Paginated audit logs response."""
    logs: List[AuditLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# =============================================================================
# SEARCH & FILTER MODELS
# =============================================================================

class UserSearchRequest(BaseModel):
    """User search and filter parameters."""
    search: Optional[str] = Field(None, max_length=100, description="Search by email or name")
    status: Optional[SubscriptionStatus] = Field(None, description="Filter by subscription status")
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=50, ge=1, le=100, description="Items per page")
    
    @validator("search")
    def sanitize_search(cls, v):
        """Sanitize search term."""
        if v:
            return sanitize_input(v, max_length=100)
        return v


# =============================================================================
# ROLE MANAGEMENT MODELS
# =============================================================================

class ChangeRoleRequest(BaseModel):
    """Request to change user role."""
    user_id: str = Field(..., description="User ID")
    new_role: UserRole = Field(..., description="New role to assign")


class RoleResponse(BaseModel):
    """Role data response."""
    id: str
    user_id: str
    role: UserRole
    created_at: datetime
    updated_at: datetime
