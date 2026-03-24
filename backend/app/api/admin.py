"""
Admin API routes.

Handles all admin operations:
- User management
- Subscription management
- Usage tracking
- Analytics
- Audit logs

Security:
- All endpoints require admin role
- All actions logged
- Rate limited
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import Optional, List

from ..models.admin_schemas import (
    AdminUserResponse,
    BlockUserRequest,
    UnblockUserRequest,
    SuspendUserRequest,
    ResumeUserRequest,
    SubscriptionResponse,
    ExtendTrialRequest,
    ActivateSubscriptionRequest,
    CancelSubscriptionRequest,
    HoldSubscriptionRequest,
    ResumeSubscriptionRequest,
    UsageMetricsResponse,
    ResetUsageRequest,
    DashboardStatsResponse,
    RevenueAnalyticsResponse,
    UsageAnalyticsResponse,
    AuditLogResponse,
    AdminPaginatedUsersResponse,
    AdminPaginatedLogsResponse,
    UserSearchRequest,
    SubscriptionStatus,
    AdminAction
)
from ..core.config import logger
from ..services.admin import admin_service
from ..middleware.admin_auth import require_admin, get_admin_with_ip
from ..middleware.rate_limit import limiter


router = APIRouter()


# =============================================================================
# ADMIN PROFILE
# =============================================================================

@router.get("/me")
@limiter.limit("60/minute")
async def get_current_admin(
    request: Request,
    admin_id: str = Depends(require_admin)
):
    """
    Get current admin's profile information.
    
    Returns:
        - Admin user details
        - Role
        - Email
    """
    try:
        user_data = await admin_service.get_user_details(admin_id)
        return {
            "id": user_data["id"],
            "email": user_data["email"],
            "full_name": user_data["full_name"],
            "role": user_data["role"]
        }
        
    except Exception as e:
        logger.error(f"Failed to get admin profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve admin profile"
        )


# =============================================================================
# DASHBOARD & ANALYTICS
# =============================================================================

@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
@limiter.limit("60/minute")
async def get_dashboard_stats(
    request: Request,
    admin_id: str = Depends(require_admin)
):
    """
    Get admin dashboard statistics.
    
    Returns:
        - Total users
        - Active subscribers
        - Trial users
        - MRR (Monthly Recurring Revenue)
        - Growth metrics
    """
    try:
        stats = await admin_service.get_dashboard_stats()
        return DashboardStatsResponse(**stats)
        
    except Exception as e:
        logger.error(f"Failed to get dashboard stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard statistics"
        )


@router.get("/analytics/revenue", response_model=List[RevenueAnalyticsResponse])
@limiter.limit("60/minute")
async def get_revenue_analytics(
    request: Request,
    admin_id: str = Depends(require_admin)
):
    """
    Get revenue analytics by month.
    
    Returns monthly breakdown of:
    - New subscriptions
    - Revenue
    - MRR added
    """
    try:
        analytics = await admin_service.get_revenue_analytics()
        return [RevenueAnalyticsResponse(**item) for item in analytics]
        
    except Exception as e:
        logger.error(f"Failed to get revenue analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve revenue analytics"
        )


@router.get("/analytics/usage", response_model=List[UsageAnalyticsResponse])
@limiter.limit("60/minute")
async def get_usage_analytics(
    request: Request,
    days: int = 30,
    admin_id: str = Depends(require_admin)
):
    """
    Get usage analytics for the last N days.
    
    Args:
        days: Number of days to retrieve (default: 30)
    
    Returns daily breakdown of:
    - Active users
    - Posts generated
    - Images generated
    - LinkedIn posts
    - API calls
    """
    try:
        analytics = await admin_service.get_usage_analytics(days=days)
        return [UsageAnalyticsResponse(**item) for item in analytics]
        
    except Exception as e:
        logger.error(f"Failed to get usage analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve usage analytics"
        )


# =============================================================================
# USER MANAGEMENT
# =============================================================================

@router.post("/users/search", response_model=AdminPaginatedUsersResponse)
@limiter.limit("60/minute")
async def search_users(
    request: Request,
    search_params: UserSearchRequest,
    admin_id: str = Depends(require_admin)
):
    """
    Search and filter users.
    
    Supports:
    - Search by email or name
    - Filter by subscription status
    - Pagination
    """
    try:
        result = await admin_service.get_all_users(
            page=search_params.page,
            page_size=search_params.page_size,
            search=search_params.search,
            status_filter=search_params.status.value if search_params.status else None
        )
        
        return AdminPaginatedUsersResponse(
            users=[AdminUserResponse(**user) for user in result["users"]],
            total=result["total"],
            page=result["page"],
            page_size=result["page_size"],
            total_pages=result["total_pages"]
        )
        
    except Exception as e:
        logger.error(f"Failed to search users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search users"
        )


@router.get("/users/{user_id}", response_model=AdminUserResponse)
@limiter.limit("60/minute")
async def get_user_details(
    request: Request,
    user_id: str,
    admin_id: str = Depends(require_admin)
):
    """
    Get detailed information about a specific user.
    
    Returns:
    - User profile
    - Subscription status
    - Usage metrics
    - Activity history
    """
    try:
        user_data = await admin_service.get_user_details(user_id)
        return AdminUserResponse(**user_data)
        
    except Exception as e:
        logger.error(f"Failed to get user details: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )


@router.post("/users/block")
@limiter.limit("10/minute")
async def block_user(
    request: Request,
    block_request: BlockUserRequest,
    admin_data: tuple = Depends(get_admin_with_ip)
):
    """
    Block a user from accessing the platform.
    
    Blocked users cannot:
    - Log in
    - Generate content
    - Post to LinkedIn
    
    This action is logged in audit logs.
    """
    admin_id, ip_address = admin_data
    
    try:
        result = await admin_service.block_user(
            admin_id=admin_id,
            user_id=block_request.user_id,
            reason=block_request.reason,
            ip_address=ip_address
        )
        
        return {
            "success": True,
            "message": f"User {block_request.user_id} has been blocked",
            "subscription": result
        }
        
    except Exception as e:
        logger.error(f"Failed to block user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to block user"
        )


@router.post("/users/unblock")
@limiter.limit("10/minute")
async def unblock_user(
    request: Request,
    unblock_request: UnblockUserRequest,
    admin_data: tuple = Depends(get_admin_with_ip)
):
    """
    Unblock a previously blocked user.
    
    User's subscription status will be restored based on:
    - Active trial (if trial not expired)
    - Active subscription (if previously paid)
    - Expired (if trial expired and no payment)
    
    This action is logged in audit logs.
    """
    admin_id, ip_address = admin_data
    
    try:
        result = await admin_service.unblock_user(
            admin_id=admin_id,
            user_id=unblock_request.user_id,
            ip_address=ip_address
        )
        
        return {
            "success": True,
            "message": f"User {unblock_request.user_id} has been unblocked",
            "subscription": result
        }
        
    except Exception as e:
        logger.error(f"Failed to unblock user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unblock user"
        )


@router.post("/users/suspend")
@limiter.limit("10/minute")
async def suspend_user(
    request: Request,
    suspend_request: SuspendUserRequest,
    admin_data: tuple = Depends(get_admin_with_ip)
):
    """
    Suspend a user's access.
    """
    admin_id, ip_address = admin_data

    try:
        result = await admin_service.suspend_user(
            admin_id=admin_id,
            user_id=suspend_request.user_id,
            reason=suspend_request.reason,
            ip_address=ip_address
        )

        return {
            "success": True,
            "message": f"User {suspend_request.user_id} has been suspended",
            "subscription": result
        }

    except Exception as e:
        logger.error(f"Failed to suspend user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to suspend user"
        )


@router.post("/users/resume")
@limiter.limit("10/minute")
async def resume_user(
    request: Request,
    resume_request: ResumeUserRequest,
    admin_data: tuple = Depends(get_admin_with_ip)
):
    """
    Resume a suspended user.
    """
    admin_id, ip_address = admin_data

    try:
        result = await admin_service.resume_user(
            admin_id=admin_id,
            user_id=resume_request.user_id,
            ip_address=ip_address
        )

        return {
            "success": True,
            "message": f"User {resume_request.user_id} has been resumed",
            "subscription": result
        }

    except Exception as e:
        logger.error(f"Failed to resume user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resume user"
        )


# =============================================================================
# SUBSCRIPTION MANAGEMENT
# =============================================================================

@router.get("/subscriptions", response_model=List[SubscriptionResponse])
@limiter.limit("60/minute")
async def get_all_subscriptions(
    request: Request,
    status_filter: Optional[SubscriptionStatus] = None,
    admin_id: str = Depends(require_admin)
):
    """
    Get all subscriptions with optional status filter.
    
    Args:
        status_filter: Filter by status (trial, active, expired, etc.)
    """
    try:
        subscriptions = await admin_service.get_all_subscriptions(
            status_filter=status_filter.value if status_filter else None
        )
        
        return [SubscriptionResponse(**sub) for sub in subscriptions]
        
    except Exception as e:
        logger.error(f"Failed to get subscriptions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscriptions"
        )


@router.post("/subscriptions/extend-trial")
@limiter.limit("10/minute")
async def extend_trial(
    request: Request,
    extend_request: ExtendTrialRequest,
    admin_data: tuple = Depends(get_admin_with_ip)
):
    """
    Extend a user's trial period.
    
    Args:
        user_id: User whose trial to extend
        days: Number of days to extend (1-365)
    
    This action is logged in audit logs.
    """
    admin_id, ip_address = admin_data
    
    try:
        result = await admin_service.extend_trial(
            admin_id=admin_id,
            user_id=extend_request.user_id,
            days=extend_request.days,
            ip_address=ip_address
        )
        
        return {
            "success": True,
            "message": f"Trial extended by {extend_request.days} days",
            "subscription": result
        }
        
    except Exception as e:
        logger.error(f"Failed to extend trial: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to extend trial"
        )


@router.post("/subscriptions/activate")
@limiter.limit("10/minute")
async def activate_subscription(
    request: Request,
    activate_request: ActivateSubscriptionRequest,
    admin_data: tuple = Depends(get_admin_with_ip)
):
    """
    Manually activate a user's subscription.
    
    Sets subscription to active with 30-day renewal period.
    Useful for:
    - Manual payments
    - Promotional activations
    - Customer service resolutions
    
    This action is logged in audit logs.
    """
    admin_id, ip_address = admin_data
    
    try:
        result = await admin_service.activate_subscription(
            admin_id=admin_id,
            user_id=activate_request.user_id,
            ip_address=ip_address
        )
        
        return {
            "success": True,
            "message": "Subscription activated successfully",
            "subscription": result
        }
        
    except Exception as e:
        logger.error(f"Failed to activate subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate subscription"
        )


@router.post("/subscriptions/cancel")
@limiter.limit("10/minute")
async def cancel_subscription(
    request: Request,
    cancel_request: CancelSubscriptionRequest,
    admin_data: tuple = Depends(get_admin_with_ip)
):
    """
    Cancel a user's subscription.
    
    User will lose access to premium features.
    
    This action is logged in audit logs.
    """
    admin_id, ip_address = admin_data
    
    try:
        result = await admin_service.cancel_subscription(
            admin_id=admin_id,
            user_id=cancel_request.user_id,
            ip_address=ip_address
        )
        
        return {
            "success": True,
            "message": "Subscription cancelled successfully",
            "subscription": result
        }
        
    except Exception as e:
        logger.error(f"Failed to cancel subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel subscription"
        )


@router.post("/subscriptions/hold")
@limiter.limit("10/minute")
async def hold_subscription(
    request: Request,
    hold_request: HoldSubscriptionRequest,
    admin_data: tuple = Depends(get_admin_with_ip)
):
    """
    Put subscription on hold.
    """
    admin_id, ip_address = admin_data

    try:
        result = await admin_service.hold_subscription(
            admin_id=admin_id,
            user_id=hold_request.user_id,
            reason=hold_request.reason,
            ip_address=ip_address
        )

        return {
            "success": True,
            "message": "Subscription put on hold successfully",
            "subscription": result
        }

    except Exception as e:
        logger.error(f"Failed to hold subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to hold subscription"
        )


@router.post("/subscriptions/resume")
@limiter.limit("10/minute")
async def resume_subscription(
    request: Request,
    resume_request: ResumeSubscriptionRequest,
    admin_data: tuple = Depends(get_admin_with_ip)
):
    """
    Resume held/cancelled subscription.
    """
    admin_id, ip_address = admin_data

    try:
        result = await admin_service.resume_subscription(
            admin_id=admin_id,
            user_id=resume_request.user_id,
            ip_address=ip_address
        )

        return {
            "success": True,
            "message": "Subscription resumed successfully",
            "subscription": result
        }

    except Exception as e:
        logger.error(f"Failed to resume subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resume subscription"
        )


# =============================================================================
# USAGE TRACKING
# =============================================================================

@router.get("/usage", response_model=List[UsageMetricsResponse])
@limiter.limit("60/minute")
async def get_usage_metrics(
    request: Request,
    user_id: Optional[str] = None,
    admin_id: str = Depends(require_admin)
):
    """
    Get usage metrics for all users or specific user.
    
    Args:
        user_id: Optional user ID to filter
    
    Returns usage data:
    - Posts generated
    - Images generated
    - LinkedIn posts
    - API calls
    - Last activity
    """
    try:
        metrics = await admin_service.get_usage_metrics(user_id=user_id)
        return [UsageMetricsResponse(**metric) for metric in metrics]
        
    except Exception as e:
        logger.error(f"Failed to get usage metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve usage metrics"
        )


@router.post("/usage/reset")
@limiter.limit("10/minute")
async def reset_usage(
    request: Request,
    reset_request: ResetUsageRequest,
    admin_data: tuple = Depends(get_admin_with_ip)
):
    """
    Reset usage metrics for a user.
    
    Resets all counters to zero:
    - Posts generated
    - Images generated
    - LinkedIn posts
    - API calls
    
    This action is logged in audit logs.
    """
    admin_id, ip_address = admin_data
    
    try:
        result = await admin_service.reset_usage(
            admin_id=admin_id,
            user_id=reset_request.user_id,
            ip_address=ip_address
        )
        
        return {
            "success": True,
            "message": "Usage metrics reset successfully",
            "usage": result
        }
        
    except Exception as e:
        logger.error(f"Failed to reset usage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset usage"
        )


# =============================================================================
# AUDIT LOGS
# =============================================================================

@router.get("/audit-logs", response_model=AdminPaginatedLogsResponse)
@limiter.limit("60/minute")
async def get_audit_logs(
    request: Request,
    page: int = 1,
    page_size: int = 50,
    admin_filter: Optional[str] = None,
    action_filter: Optional[AdminAction] = None,
    admin_id: str = Depends(require_admin)
):
    """
    Get admin audit logs with pagination and filtering.
    
    Args:
        page: Page number
        page_size: Items per page
        admin_filter: Filter by admin ID
        action_filter: Filter by action type
    
    Returns all admin actions:
    - User blocks/unblocks
    - Subscription changes
    - Trial extensions
    - Usage resets
    """
    try:
        result = await admin_service.get_audit_logs(
            page=page,
            page_size=page_size,
            admin_id=admin_filter,
            action_filter=action_filter.value if action_filter else None
        )
        
        return AdminPaginatedLogsResponse(
            logs=[AuditLogResponse(**log) for log in result["logs"]],
            total=result["total"],
            page=result["page"],
            page_size=result["page_size"],
            total_pages=result["total_pages"]
        )
        
    except Exception as e:
        logger.error(f"Failed to get audit logs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve audit logs"
        )
