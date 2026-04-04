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

Performance:
- Dashboard queries run in parallel using asyncio.gather
- Subscription check cached within request scope
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import timedelta
import asyncio

from ..core.config import logger
from ..core.datetime_utils import is_future_datetime, utc_now
from ..services.content_queue import queue_service
from ..services.scheduler import scheduler_service
from ..worker.auto_generator import auto_generator_worker
from ..middleware.admin_auth import get_current_user_id
from ..middleware.rate_limit import limiter


router = APIRouter()


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class GenerateQueueRequest(BaseModel):
    # Changed default from 7 to 2 — rolling queue, not bulk generation
    count: int = Field(default=2, ge=1, le=10)
    categories: Optional[List[str]] = None


class ScheduleConfigRequest(BaseModel):
    days_of_week: List[str] = Field(default_factory=list)
    time_of_day: str = Field(..., description="Comma-separated slots e.g. 09:00,12:00")
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
    Generate posts for user's queue (rolling queue — 1-2 posts, saved as pending_review).

    Requires active subscription or trial.
    Generated posts require user review before scheduling/publishing.
    """
    try:
        posts = await queue_service.fill_user_queue(
            user_id=user_id,
            count=body.count,
            categories=body.categories
        )

        return {
            "success": True,
            "message": f"Generated {len(posts)} posts — please review and approve before publishing",
            "posts": posts,
            "status": "pending_review"
        }

    except Exception as e:
        logger.error(f"Queue generation failed for user {user_id}: {e}")

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

    Optional status filter: draft, pending_review, scheduled, posted, failed
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
        logger.error(f"Failed to get queue for {user_id}: {e}")
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
        logger.error(f"Failed to get schedule for {user_id}: {e}")
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

        # Trigger background rescheduling for future queued posts so they snap to the new settings
        try:
            import asyncio
            asyncio.create_task(scheduler_service.reschedule_future_posts(user_id, schedule))
        except Exception as e:
            logger.error(f"Failed to queue rescheduling task: {e}")

        if body.is_active and body.auto_topic:
            try:
                asyncio.create_task(auto_generator_worker.process_user_auto_generation(user_id))
            except Exception as e:
                logger.error(f"Failed to queue auto-generation task: {e}")

        return {
            "success": True,
            "message": (
                "Schedule updated successfully. "
                "Auto-generation has been queued for your upcoming slots."
                if body.is_active and body.auto_topic
                else "Schedule updated successfully"
            ),
            "schedule": schedule
        }

    except Exception as e:
        logger.error(f"Failed to update schedule for {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update schedule"
        )


@router.post("/schedule/auto-generate")
@limiter.limit("10/minute")
async def auto_generate_schedule_posts(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """Generate upcoming scheduled posts immediately for the current user."""
    try:
        stats = await auto_generator_worker.process_user_auto_generation(user_id)
        return {
            "success": True,
            "message": (
                f"Generated {stats['generated']} scheduled posts for upcoming slots."
                if stats["generated"] > 0
                else "No new scheduled posts were needed for upcoming slots."
            ),
            "stats": stats,
        }
    except Exception as e:
        logger.error(f"Failed to auto-generate schedule posts for {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate scheduled posts"
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

    Performance: All DB queries run in parallel using asyncio.gather.

    Returns:
    - Subscription status
    - Usage metrics
    - Next scheduled post
    - Recent posts
    - LinkedIn connection status
    """
    try:
        from ..services.database import supabase_client

        now = utc_now()
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        now_iso = now.isoformat()
        day_start_iso = start_of_day.isoformat()

        # -----------------------------------------------------------------------
        # Run all independent DB queries in PARALLEL for performance
        # -----------------------------------------------------------------------
        async def get_subscription():
            try:
                result = supabase_client.admin.table("subscriptions").select(
                    "*"
                ).eq("user_id", user_id).limit(1).execute()

                if result.data:
                    return result.data[0]

                # Self-heal: create trial subscription for new users
                trial_end = now.replace(microsecond=0) + timedelta(days=30)
                created = supabase_client.admin.table("subscriptions").upsert(
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
                return created.data[0] if created.data else {"status": "trial"}
            except Exception as e:
                logger.error(f"Failed to fetch subscription for {user_id}: {e}")
                return {"status": "expired"}

        async def get_usage():
            try:
                result = supabase_client.admin.table("usage_metrics").select(
                    "*"
                ).eq("user_id", user_id).limit(1).execute()

                if result.data:
                    return result.data[0]

                created = supabase_client.admin.table("usage_metrics").upsert(
                    {"user_id": user_id},
                    on_conflict="user_id",
                ).execute()
                return created.data[0] if created.data else {
                    "posts_generated": 0,
                    "linkedin_posts": 0,
                }
            except Exception as e:
                logger.error(f"Failed to fetch usage for {user_id}: {e}")
                return {"posts_generated": 0, "linkedin_posts": 0}

        async def get_total_posted():
            try:
                result = supabase_client.admin.table("posts").select(
                    "id", count="exact"
                ).eq("user_id", user_id).eq("status", "posted").execute()
                return (
                    result.count
                    if hasattr(result, 'count') and result.count is not None
                    else len(result.data or [])
                )
            except Exception as e:
                logger.error(f"Failed to fetch total_posted for {user_id}: {e}")
                return 0

        async def get_posted_today():
            try:
                result = supabase_client.admin.table("posts").select(
                    "id", count="exact"
                ).eq("user_id", user_id).eq("status", "posted").gte(
                    "posted_at", day_start_iso
                ).execute()
                return (
                    result.count
                    if hasattr(result, 'count') and result.count is not None
                    else len(result.data or [])
                )
            except Exception as e:
                logger.error(f"Failed to fetch posted_today for {user_id}: {e}")
                return 0

        async def get_next_post():
            try:
                result = supabase_client.admin.table("posts").select(
                    "*"
                ).eq("user_id", user_id).eq("status", "scheduled").order(
                    "scheduled_at"
                ).limit(1).execute()
                return result.data[0] if result.data else None
            except Exception as e:
                logger.warning(f"Failed to fetch next post for {user_id}: {e}")
                return None

        async def get_recent_posts():
            try:
                result = supabase_client.admin.table("posts").select(
                    "*"
                ).eq("user_id", user_id).order(
                    "created_at", desc=True
                ).limit(5).execute()
                return result.data or []
            except Exception as e:
                logger.warning(f"Failed to fetch recent posts for {user_id}: {e}")
                return []

        async def get_linkedin_status():
            try:
                result = supabase_client.admin.table("linkedin_tokens").select(
                    "expires_at"
                ).eq("user_id", user_id).execute()
                if result.data:
                    return is_future_datetime(result.data[0].get("expires_at"))
                return False
            except Exception as e:
                logger.warning(f"Failed to fetch LinkedIn status for {user_id}: {e}")
                return False

        # Execute all queries in parallel
        (
            subscription,
            usage,
            total_posted,
            posted_today,
            next_post,
            recent_posts,
            linkedin_connected,
            schedule
        ) = await asyncio.gather(
            get_subscription(),
            get_usage(),
            get_total_posted(),
            get_posted_today(),
            get_next_post(),
            get_recent_posts(),
            get_linkedin_status(),
            scheduler_service.get_user_schedule(user_id)
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
        logger.error(f"Failed to get dashboard data for {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard data"
        )
