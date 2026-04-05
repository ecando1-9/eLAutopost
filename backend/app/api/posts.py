"""
Posts Management API routes.

Handles:
- Creating post drafts
- Updating posts
- Deleting posts
- Listing user posts
- Posting to LinkedIn
- Post status tracking

Security:
- User can only access their own posts (RLS)
- Rate limiting on posting
- Input validation
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import List, Optional
from datetime import timedelta
from pydantic import BaseModel

from ..models.schemas import (
    PostCreate,
    PostUpdate,
    PostResponse,
    PostStatus,
    LinkedInPostRequest,
    LinkedInPostResponse,
    PaginationParams
)
from ..core.config import logger
from ..core.datetime_utils import utc_now, parse_datetime_utc
from ..core.text_utils import strip_markdown_formatting
from ..services.database import supabase_client, log_audit_event
from ..services.linkedin import linkedin_service
from ..services.automation_defaults import (
    build_generation_instructions,
    compose_linkedin_caption,
    load_user_automation_settings,
)
from ..services.content_generation import content_service
from ..core.security import get_client_ip
from ..core.security import sanitize_input
from ..middleware.rate_limit import limiter, POSTING_RATE_LIMIT
from ..middleware.admin_auth import get_current_user_id


router = APIRouter()


class SchedulePostRequest(BaseModel):
    scheduled_at: Optional[str] = None
    target: Optional[str] = "person"
    organization_id: Optional[str] = None


class AIRewritePostRequest(BaseModel):
    prompt: Optional[str] = None
    topic: Optional[str] = None


_POST_TARGET_COLUMNS_AVAILABLE: Optional[bool] = None


def _supports_post_target_columns() -> bool:
    """
    Detect whether posts table contains target/organization_id columns.
    Allows backward compatibility before SQL migration is applied.
    """
    global _POST_TARGET_COLUMNS_AVAILABLE
    if _POST_TARGET_COLUMNS_AVAILABLE is not None:
        return _POST_TARGET_COLUMNS_AVAILABLE

    try:
        supabase_client.admin.table("posts").select(
            "target,organization_id"
        ).limit(1).execute()
        _POST_TARGET_COLUMNS_AVAILABLE = True
    except Exception:
        _POST_TARGET_COLUMNS_AVAILABLE = False

    return _POST_TARGET_COLUMNS_AVAILABLE


def _normalize_post_record(record: dict) -> dict:
    """Fill defaults for optional target fields."""
    if "target" not in record:
        record["target"] = "person"
    if "organization_id" not in record:
        record["organization_id"] = None
    return record


# =============================================================================
# POST CRUD OPERATIONS
# =============================================================================

@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_post(
    request: Request, 
    post_data: PostCreate, 
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a new post draft.
    
    Args:
        post_data: Post data
        user_id: Authenticated user ID
        
    Returns:
        Created post
    """
    try:
        # Create post in database
        insert_data = {
            "user_id": user_id,
            "topic": post_data.topic,
            "hook": post_data.hook,
            "image_prompt": post_data.image_prompt,
            "caption": post_data.caption,
            "content_type": post_data.content_type.value,
            "image_url": post_data.image_url,
            "status": "draft"
        }

        if _supports_post_target_columns():
            insert_data["target"] = post_data.target or "person"
            insert_data["organization_id"] = post_data.organization_id

        result = supabase_client.admin.table("posts").insert(insert_data).execute()
        
        post = result.data[0]
        
        # Log event
        await log_audit_event(
            user_id=user_id,
            event_type="post_created",
            details={"post_id": post["id"], "topic": post_data.topic},
            ip_address=get_client_ip(request)
        )
        
        logger.info(f"Post created for user {user_id}: {post['id']}")
        
        return PostResponse(**_normalize_post_record(post))
        
    except Exception as e:
        logger.error(f"Failed to create post: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create post"
        )


@router.get("/", response_model=List[PostResponse])
@limiter.limit("60/minute")
async def list_posts(
    request: Request,
    status_filter: Optional[PostStatus] = None,
    page: int = 1,
    page_size: int = 20,
    user_id: str = Depends(get_current_user_id)
):
    """
    List user's posts with optional filtering.
    
    Args:
        user_id: Authenticated user ID
        status_filter: Optional status filter
        page: Page number
        page_size: Items per page
        
    Returns:
        List of posts
    """
    try:
        # Build query
        query = supabase_client.admin.table("posts").select("*").eq("user_id", user_id)
        
        # Apply status filter
        if status_filter:
            query = query.eq("status", status_filter.value)
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.order("created_at", desc=True).range(offset, offset + page_size - 1)
        
        result = query.execute()
        
        return [PostResponse(**_normalize_post_record(post)) for post in result.data]
        
    except Exception as e:
        logger.error(f"Failed to list posts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve posts"
        )


@router.get("/{post_id}", response_model=PostResponse)
@limiter.limit("60/minute")
async def get_post(
    request: Request, 
    post_id: str, 
    user_id: str = Depends(get_current_user_id)
):
    """
    Get a specific post.
    
    Args:
        post_id: Post ID
        user_id: Authenticated user ID
        
    Returns:
        Post data
    """
    try:
        result = supabase_client.admin.table("posts").select("*").eq(
            "id", post_id
        ).eq("user_id", user_id).single().execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )
        
        return PostResponse(**_normalize_post_record(result.data))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get post: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve post"
        )


@router.patch("/{post_id}", response_model=PostResponse)
@limiter.limit("30/minute")
async def update_post(
    request: Request,
    post_id: str,
    post_update: PostUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """
    Update a post.
    
    Args:
        post_id: Post ID
        post_update: Update data
        user_id: Authenticated user ID
        
    Returns:
        Updated post
    """
    try:
        existing_result = supabase_client.admin.table("posts").select("*").eq(
            "id", post_id
        ).eq("user_id", user_id).single().execute()

        if not existing_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )

        existing_post = existing_result.data
        if existing_post.get("status") in {"posted", "running"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only posts that have not been published yet can be edited"
            )

        # Build update data (only include non-None fields)
        update_data = {}
        if post_update.topic is not None:
            update_data["topic"] = post_update.topic
        if post_update.hook is not None:
            update_data["hook"] = post_update.hook
        if post_update.caption is not None:
            update_data["caption"] = post_update.caption
        if post_update.image_url is not None:
            update_data["image_url"] = post_update.image_url
        if post_update.status is not None:
            update_data["status"] = post_update.status.value
        if _supports_post_target_columns():
            if post_update.target is not None:
                update_data["target"] = post_update.target
            if post_update.organization_id is not None:
                update_data["organization_id"] = post_update.organization_id
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update data provided"
            )

        if (
            existing_post.get("status") == "failed"
            and post_update.status is None
            and any(field in update_data for field in {"topic", "hook", "caption"})
        ):
            update_data["status"] = "pending_review"

        if any(field in update_data for field in {"topic", "hook", "caption", "image_url"}):
            update_data["error_message"] = None
        
        # Update post
        result = supabase_client.admin.table("posts").update(update_data).eq(
            "id", post_id
        ).eq("user_id", user_id).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )
        
        # Log event
        await log_audit_event(
            user_id=user_id,
            event_type="post_updated",
            details={"post_id": post_id, "updates": list(update_data.keys())},
            ip_address=get_client_ip(request)
        )
        
        return PostResponse(**_normalize_post_record(result.data[0]))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update post: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update post"
        )


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def delete_post(
    request: Request, 
    post_id: str, 
    user_id: str = Depends(get_current_user_id)
):
    """
    Delete a post.
    
    Args:
        post_id: Post ID
        user_id: Authenticated user ID
    """
    try:
        result = supabase_client.admin.table("posts").delete().eq(
            "id", post_id
        ).eq("user_id", user_id).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )
        
        # Log event
        await log_audit_event(
            user_id=user_id,
            event_type="post_deleted",
            details={"post_id": post_id},
            ip_address=get_client_ip(request)
        )
        
        logger.info(f"Post deleted: {post_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete post: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete post"
        )


# =============================================================================
# LINKEDIN POSTING
# =============================================================================

@router.post("/{post_id}/publish", response_model=LinkedInPostResponse)
@limiter.limit(POSTING_RATE_LIMIT)
async def publish_to_linkedin(
    request: Request,
    post_id: str,
    target: Optional[str] = None,
    organization_id: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """
    Publish a post to LinkedIn.
    
    Security:
    - Rate limited to prevent spam
    - Requires LinkedIn connection
    - Updates post status
    
    Args:
        post_id: Post ID to publish
        user_id: Authenticated user ID
        
    Returns:
        LinkedIn post response
    """
    try:
        # Get post
        post_result = supabase_client.admin.table("posts").select("*").eq(
            "id", post_id
        ).eq("user_id", user_id).single().execute()
        
        if not post_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )
        
        post = post_result.data
        
        # Check if already posted
        if post["status"] == "posted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Post already published"
            )
        
        try:
            resolved_target = target or post.get("target") or "person"
            resolved_organization_id = organization_id or post.get("organization_id")
            if resolved_target not in {"person", "organization"}:
                resolved_target = "person"
            clean_caption = strip_markdown_formatting(post["caption"])

            # Post to LinkedIn
            if post["image_url"]:
                linkedin_response = await linkedin_service.post_with_image(
                    user_id=user_id,
                    text=clean_caption,
                    image_url=post["image_url"],
                    target=resolved_target,
                    organization_id=resolved_organization_id
                )
            else:
                linkedin_response = await linkedin_service.post_text(
                    user_id=user_id,
                    text=clean_caption,
                    target=resolved_target,
                    organization_id=resolved_organization_id
                )
            
            # Extract post ID from response
            linkedin_post_id = linkedin_response.get("id", "")
            linkedin_url = linkedin_service._build_post_url(linkedin_post_id)
            
            # Update post status to posted
            supabase_client.admin.table("posts").update({
                "status": "posted",
                "caption": clean_caption,
                "posted_at": utc_now().isoformat(),
                "linkedin_post_id": linkedin_post_id,
                "linkedin_url": linkedin_url
            }).eq("id", post_id).execute()
            
            # Log event
            await log_audit_event(
                user_id=user_id,
                event_type="post_published",
                details={
                    "post_id": post_id,
                    "linkedin_post_id": linkedin_post_id
                },
                ip_address=get_client_ip(request)
            )
            
            logger.info(f"Post published to LinkedIn: {post_id}")
            
            return LinkedInPostResponse(
                post_id=post_id,
                status=PostStatus.POSTED,
                posted_at=utc_now(),
                linkedin_url=linkedin_url,
                error_message=None
            )
            
        except Exception as e:
            # Update status to failed
            error_message = str(e)
            supabase_client.admin.table("posts").update({
                "status": "failed",
                "error_message": error_message
            }).eq("id", post_id).execute()
            
            logger.error(f"LinkedIn posting failed for post {post_id}: {e}")
            
            return LinkedInPostResponse(
                post_id=post_id,
                status=PostStatus.FAILED,
                posted_at=None,
                linkedin_url=None,
                error_message=error_message
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to publish post: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to publish post: {str(e)}"
        )


@router.post("/{post_id}/schedule", response_model=PostResponse)
@limiter.limit("30/minute")
async def schedule_post(
    request: Request,
    post_id: str,
    body: SchedulePostRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Schedule a draft/failed post for later publishing.
    """
    try:
        post_result = supabase_client.admin.table("posts").select("*").eq(
            "id", post_id
        ).eq("user_id", user_id).single().execute()

        if not post_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )

        current_status = post_result.data.get("status")
        if current_status == "posted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Posted content cannot be rescheduled"
            )

        target_dt = None
        if body.scheduled_at:
            try:
                target_dt = parse_datetime_utc(body.scheduled_at)
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid scheduled_at datetime format"
                )
        if target_dt is None:
            target_dt = utc_now() + timedelta(minutes=30)

        update_data = {
            "status": "scheduled",
            "scheduled_at": target_dt.isoformat(),
            "error_message": None
        }
        if _supports_post_target_columns():
            if body.target in {"person", "organization"}:
                update_data["target"] = body.target
            if body.organization_id is not None:
                update_data["organization_id"] = body.organization_id

        update_result = supabase_client.admin.table("posts").update(update_data).eq(
            "id", post_id
        ).eq("user_id", user_id).execute()

        if not update_result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to schedule post"
            )

        await log_audit_event(
            user_id=user_id,
            event_type="post_scheduled",
            details={
                "post_id": post_id,
                "scheduled_at": target_dt.isoformat()
            },
            ip_address=get_client_ip(request)
        )

        return PostResponse(**_normalize_post_record(update_result.data[0]))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to schedule post {post_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to schedule post"
        )


@router.post("/{post_id}/ai-rewrite", response_model=PostResponse)
@limiter.limit("20/minute")
async def ai_rewrite_post(
    request: Request,
    post_id: str,
    body: AIRewritePostRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Rework an existing unpublished post using the latest saved automation settings
    plus an optional user prompt from the queue UI.
    """
    try:
        post_result = supabase_client.admin.table("posts").select("*").eq(
            "id", post_id
        ).eq("user_id", user_id).single().execute()

        if not post_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )

        post = post_result.data
        if post.get("status") in {"posted", "running"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only posts that have not been published yet can be rewritten"
            )

        rewritten_topic = sanitize_input(
            (body.topic or post.get("topic") or "").strip(),
            max_length=200
        )
        if not rewritten_topic:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Topic is required to rewrite a post"
            )

        rewrite_prompt = sanitize_input(
            (body.prompt or "").strip(),
            max_length=500
        )

        user_settings = await load_user_automation_settings(user_id)
        instructions_parts = [
            build_generation_instructions(user_settings),
            f"Rewrite an existing LinkedIn post about {rewritten_topic}.",
            f"Current hook: {post.get('hook', '')}",
            f"Current caption: {post.get('caption', '')}",
            "Keep the content high-quality, specific, and ready to publish on LinkedIn.",
            "Treat the user's rewrite direction as the highest priority instruction.",
            "If the user's rewrite direction changes the audience, tone, angle, or perspective, follow that direction even when it conflicts with saved defaults.",
        ]
        if rewrite_prompt:
            instructions_parts.append(f"User direction for this rewrite: {rewrite_prompt}")

        generated = await content_service.generate_content(
            topic=rewritten_topic,
            goal=user_settings.get("default_goal", "Authority"),
            audience=user_settings.get("default_audience", "General Professionals"),
            style=user_settings.get("default_style", "Carousel slides"),
            tone=user_settings.get("default_tone", "professional"),
            instructions=" ".join(part for part in instructions_parts if part),
        )

        update_data = {
            "topic": rewritten_topic,
            "hook": strip_markdown_formatting(getattr(generated, "hook", "")).strip() or post.get("hook"),
            "caption": compose_linkedin_caption(generated),
            "image_prompt": (
                strip_markdown_formatting(getattr(generated, "image_prompt", "")).strip()
                or post.get("image_prompt")
            ),
            "content_type": generated.content_type.value,
            "error_message": None,
        }

        if post.get("status") == "failed":
            update_data["status"] = "pending_review"

        update_result = supabase_client.admin.table("posts").update(update_data).eq(
            "id", post_id
        ).eq("user_id", user_id).execute()

        if not update_result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to rewrite post"
            )

        await log_audit_event(
            user_id=user_id,
            event_type="post_ai_rewritten",
            details={
                "post_id": post_id,
                "prompt": rewrite_prompt,
                "topic": rewritten_topic,
            },
            ip_address=get_client_ip(request)
        )

        return PostResponse(**_normalize_post_record(update_result.data[0]))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to rewrite post {post_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to rewrite post"
        )


# =============================================================================
# POST STATISTICS
# =============================================================================

@router.get("/stats/summary", response_model=dict)
@limiter.limit("60/minute")
async def get_post_stats(
    request: Request, 
    user_id: str = Depends(get_current_user_id)
):
    """
    Get post statistics for the user.
    
    Returns:
        Post statistics
    """
    try:
        # Get all posts for user
        result = supabase_client.admin.table("posts").select("*").eq(
            "user_id", user_id
        ).execute()
        
        posts = result.data
        
        # Calculate stats
        total_posts = len(posts)
        posted_count = len([p for p in posts if p["status"] == "posted"])
        draft_count = len([p for p in posts if p["status"] == "draft"])
        failed_count = len([p for p in posts if p["status"] == "failed"])
        
        # Count by content type
        type_counts = {}
        for post in posts:
            content_type = post["content_type"]
            type_counts[content_type] = type_counts.get(content_type, 0) + 1
        
        return {
            "total_posts": total_posts,
            "posted": posted_count,
            "drafts": draft_count,
            "failed": failed_count,
            "by_content_type": type_counts
        }
        
    except Exception as e:
        logger.error(f"Failed to get post stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve statistics"
        )
