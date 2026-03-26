"""
User Content API routes.

Handles:
- Content generation
- Queue management
- Post scheduling
- User dashboard data

Security:
- Requires authentication
- Subscription validation
- Rate limiting
- Input sanitization
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import timedelta

from ..core.config import logger
from ..core.datetime_utils import is_future_datetime, utc_now
from ..services.content_queue import queue_service
from ..services.scheduler import scheduler_service
from ..middleware.admin_auth import get_current_user_id
from ..middleware.rate_limit import limiter


router = APIRouter()


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class GenerateQueueRequest(BaseModel):
    count: int = Field(default=7, ge=1, le=30)
    categories: Optional[List[str]] = None


class ScheduleConfigRequest(BaseModel):
    days_of_week: List[str] = Field(default_factory=list, max_items=7)
    time_of_day: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    timezone: str = Field(default="Asia/Kolkata")
    is_active: bool = True
    categories: Optional[List[str]] = None
    auto_topic: bool = True


# =============================================================================
# CONTENT GENERATION
# =============================================================================

@router.post("/generate-queue")
@limiter.limit("10/hour")  # Limit to prevent abuse
async def generate_content_queue(
    request: Request,
    body: GenerateQueueRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Generate multiple posts for user's queue.
    
    Requires active subscription or trial.
    """
    try:
        posts = await queue_service.fill_user_queue(
            user_id=user_id,
            count=body.count,
            categories=body.categories
        )
        
        return {
            "success": True,
            "message": f"Generated {len(posts)} posts",
            "posts": posts
        }
        
    except Exception as e:
        logger.error(f"Queue generation failed: {e}")
        
        if "Subscription required" in str(e):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "error": "Subscription Required",
                    "message": "Your trial has expired. Please upgrade to continue.",
                    "upgrade_url": "/pricing"
                }
            )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate content queue"
        )


@router.get("/queue")
@limiter.limit("60/minute")
async def get_user_queue(
    request: Request,
    status_filter: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get user's content queue.
    
    Optional status filter: draft, scheduled, posted, failed
    """
    try:
        posts = await queue_service.get_user_queue(
            user_id=user_id,
            status=status_filter
        )
        
        return {
            "success": True,
            "posts": posts,
            "total": len(posts)
        }
        
    except Exception as e:
        logger.error(f"Failed to get queue: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve content queue"
        )


# =============================================================================
# SCHEDULING
# =============================================================================

@router.get("/schedule")
@limiter.limit("60/minute")
async def get_user_schedule(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """Get user's posting schedule configuration."""
    try:
        schedule = await scheduler_service.get_user_schedule(user_id)
        
        if not schedule:
            return {
                "success": True,
                "schedule": None,
                "message": "No schedule configured"
            }
        
        return {
            "success": True,
            "schedule": schedule
        }
        
    except Exception as e:
        logger.error(f"Failed to get schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve schedule"
        )


@router.post("/schedule")
@limiter.limit("20/hour")
async def update_user_schedule(
    request: Request,
    body: ScheduleConfigRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Update user's posting schedule."""
    try:
        schedule = await scheduler_service.update_user_schedule(
            user_id=user_id,
            days_of_week=body.days_of_week,
            time_of_day=body.time_of_day,
            timezone=body.timezone,
            is_active=body.is_active,
            categories=body.categories,
            auto_topic=body.auto_topic
        )
        
        return {
            "success": True,
            "message": "Schedule updated successfully",
            "schedule": schedule
        }
        
    except Exception as e:
        logger.error(f"Failed to update schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update schedule"
        )


# =============================================================================
# DASHBOARD DATA
# =============================================================================

@router.get("/dashboard")
@limiter.limit("60/minute")
async def get_user_dashboard(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get user dashboard data.
    
    Returns:
    - Subscription status
    - Usage metrics
    - Next scheduled post
    - Recent posts
    """
    try:
        from ..services.database import supabase_client

        # Get subscription info
        try:
            sub_result = supabase_client.admin.table("subscriptions").select(
                "*"
            ).eq("user_id", user_id).limit(1).execute()

            if sub_result.data:
                subscription = sub_result.data[0]
            else:
                # Self-heal missing subscription records for legacy users.
                now = utc_now()
                trial_end = now.replace(microsecond=0) + timedelta(days=30)
                created_sub = supabase_client.admin.table("subscriptions").upsert(
                    {
                        "user_id": user_id,
                        "plan_name": "monthly",
                        "price": 299.00,
                        "currency": "INR",
                        "status": "trial",
                        "trial_start": now.isoformat(),
                        "trial_end": trial_end.isoformat(),
                    },
                    on_conflict="user_id",
                ).execute()
                subscription = created_sub.data[0] if created_sub.data else {
                    "user_id": user_id,
                    "plan_name": "monthly",
                    "price": 299.00,
                    "currency": "INR",
                    "status": "trial",
                    "trial_start": now.isoformat(),
                    "trial_end": trial_end.isoformat(),
                }
        except Exception as sub_error:
            logger.error(f"Failed to fetch subscription for {user_id}: {sub_error}")
            subscription = {
                "user_id": user_id,
                "status": "expired",
            }

        # Get usage metrics
        try:
            usage_result = supabase_client.admin.table("usage_metrics").select(
                "*"
            ).eq("user_id", user_id).limit(1).execute()

            if usage_result.data:
                usage = usage_result.data[0]
            else:
                created_usage = supabase_client.admin.table("usage_metrics").upsert(
                    {"user_id": user_id},
                    on_conflict="user_id",
                ).execute()
                usage = created_usage.data[0] if created_usage.data else {
                    "user_id": user_id,
                    "posts_generated": 0,
                    "images_generated": 0,
                    "linkedin_posts": 0,
                    "api_calls": 0,
                }
        except Exception as usage_error:
            logger.error(f"Failed to fetch usage for {user_id}: {usage_error}")
            usage = {
                "user_id": user_id,
                "posts_generated": 0,
                "images_generated": 0,
                "linkedin_posts": 0,
                "api_calls": 0,
            }

        # Get actual post stats for the dashboard showing total and today
        now = utc_now()
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        try:
            # Total posted
            total_posted_res = supabase_client.admin.table("posts").select(
                "id", count="exact"
            ).eq("user_id", user_id).eq("status", "posted").execute()
            total_posted = total_posted_res.count if hasattr(total_posted_res, 'count') and total_posted_res.count is not None else (len(total_posted_res.data) if getattr(total_posted_res, 'data', None) is not None else 0)
            
            # Posted today
            today_posted_res = supabase_client.admin.table("posts").select(
                "id", count="exact"
            ).eq("user_id", user_id).eq("status", "posted").gte("posted_at", start_of_day.isoformat()).execute()
            posted_today = today_posted_res.count if hasattr(today_posted_res, 'count') and today_posted_res.count is not None else (len(today_posted_res.data) if getattr(today_posted_res, 'data', None) is not None else 0)
        except Exception as e:
            logger.error(f"Failed to fetch real-time post stats: {e}")
            total_posted = usage.get("linkedin_posts", 0)
            posted_today = 0

        # Get schedule
        schedule = await scheduler_service.get_user_schedule(user_id)

        # Get next scheduled post
        next_post = None
        try:
            next_post_result = supabase_client.admin.table("posts").select(
                "*"
            ).eq("user_id", user_id).eq("status", "scheduled").order(
                "scheduled_at"
            ).limit(1).execute()
            next_post = next_post_result.data[0] if next_post_result.data else None
        except Exception as next_post_error:
            # Backward-compatible fallback for older DBs without scheduled_at.
            logger.warning(
                f"Primary next-post query failed for {user_id}, using fallback: {next_post_error}"
            )
            try:
                fallback_result = supabase_client.admin.table("posts").select(
                    "*"
                ).eq("user_id", user_id).eq("status", "scheduled").order(
                    "created_at", desc=True
                ).limit(1).execute()
                next_post = fallback_result.data[0] if fallback_result.data else None
            except Exception as fallback_error:
                logger.warning(f"Fallback next-post query failed for {user_id}: {fallback_error}")
                next_post = None

        # Get recent posts
        try:
            recent_posts_result = supabase_client.admin.table("posts").select(
                "*"
            ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
            recent_posts = recent_posts_result.data or []
        except Exception as recent_posts_error:
            logger.warning(f"Failed to fetch recent posts for {user_id}: {recent_posts_error}")
            recent_posts = []

        # Check LinkedIn connection
        linkedin_token = supabase_client.admin.table("linkedin_tokens").select(
            "expires_at"
        ).eq("user_id", user_id).execute()

        linkedin_connected = False
        if linkedin_token.data:
            linkedin_connected = is_future_datetime(
                linkedin_token.data[0].get("expires_at")
            )
        
        return {
            "success": True,
            "linkedin_connected": linkedin_connected,
            "subscription": subscription,
            "usage": usage,
            "schedule": schedule,
            "next_post": next_post,
            "recent_posts": recent_posts,
            "total_posted": total_posted,
            "posted_today": posted_today
        }
        
    except Exception as e:
        logger.error(f"Failed to get dashboard data: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard data"
        )
