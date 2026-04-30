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
import asyncio

from ..core.config import logger
from ..core.datetime_utils import is_future_datetime, utc_now
from ..services.billing import billing_service
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
        # Read the OLD schedule before overwriting so we can detect time changes
        old_schedule = await scheduler_service.get_user_schedule(user_id)
        old_time_of_day = str((old_schedule or {}).get("time_of_day", "") or "")
        old_days = sorted(str(day).strip().upper() for day in ((old_schedule or {}).get("days_of_week") or []))
        old_timezone = str((old_schedule or {}).get("timezone", "") or "")

        schedule = await scheduler_service.update_user_schedule(
            user_id=user_id,
            days_of_week=body.days_of_week,
            time_of_day=body.time_of_day,
            timezone=body.timezone,
            is_active=body.is_active,
            categories=body.categories,
            auto_topic=body.auto_topic
        )

        # If timing rules changed, move existing future posts onto the new slots.
        # The generator then only fills missing slots.
        new_days = sorted(str(day).strip().upper() for day in (body.days_of_week or []))
        schedule_changed = (
            body.time_of_day.strip() != old_time_of_day.strip()
            or new_days != old_days
            or body.timezone.strip() != old_timezone.strip()
        )
        rescheduled_count = 0
        if schedule_changed and body.is_active:
            rescheduled_count = await scheduler_service.reschedule_future_posts(
                user_id=user_id,
                schedule=schedule,
            )

        generation_stats = None
        if body.is_active and body.auto_topic:
            try:
                generation_stats = await auto_generator_worker.process_user_auto_generation(
                    user_id=user_id,
                    schedule=schedule,
                    slot_limit=1,
                )

                if generation_stats.get("remaining_slots", 0) > 0:
                    import asyncio
                    asyncio.create_task(
                        auto_generator_worker.process_user_auto_generation(
                            user_id=user_id,
                            schedule=schedule,
                        )
                    )
            except Exception as e:
                logger.error(f"Failed to queue auto-generation task: {e}")

        message = "Settings updated successfully."
        if body.is_active and body.auto_topic:
            message = "Settings saved."
            if rescheduled_count:
                message += (
                    f" {rescheduled_count} future post"
                    f"{'' if rescheduled_count == 1 else 's'} moved to the new schedule."
                )

            if generation_stats:
                if generation_stats.get("generated", 0) > 0:
                    message += " The next scheduled post is ready for review."
                    if generation_stats.get("remaining_slots", 0) > 0:
                        message += " More upcoming posts are being prepared in the background."
                elif generation_stats.get("past_today_slots", 0) > 0 and generation_stats.get("future_today_slots", 0) == 0:
                    message += " Today's earlier slot time has already passed, so it will not be generated."
                    if generation_stats.get("future_tomorrow_slots", 0) > 0:
                        message += " Tomorrow's posts are being prepared next."
                elif generation_stats.get("future_today_slots", 0) > 0:
                    next_slot_label = generation_stats.get("next_slot_label") or "the next slot"
                    message += f" The next post will be generated for {next_slot_label}."
                elif generation_stats.get("future_tomorrow_slots", 0) > 0:
                    message += " No valid slots are left for today. Tomorrow's posts are being prepared."
                else:
                    message += " No new future slot was available to generate right now."

        return {
            "success": True,
            "message": message,
            "schedule": schedule,
            "generation": generation_stats,
            "rescheduled_count": rescheduled_count,
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
                return await billing_service.get_or_create_subscription(user_id)
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
            "billing": billing_service.get_plan_metadata(),
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
