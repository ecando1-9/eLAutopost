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

from fastapi import APIRouter, HTTPException, status, Request
from typing import List, Optional
from datetime import datetime

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
from ..services.database import supabase_client, log_audit_event
from ..services.linkedin import linkedin_service
from ..core.security import get_client_ip
from ..middleware.rate_limit import limiter, POSTING_RATE_LIMIT


router = APIRouter()


# =============================================================================
# POST CRUD OPERATIONS
# =============================================================================

@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_post(request: Request, post_data: PostCreate, user_id: str):
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
        result = supabase_client.admin.table("posts").insert({
            "user_id": user_id,
            "topic": post_data.topic,
            "hook": post_data.hook,
            "image_prompt": post_data.image_prompt,
            "caption": post_data.caption,
            "content_type": post_data.content_type.value,
            "image_url": post_data.image_url,
            "status": "draft"
        }).execute()
        
        post = result.data[0]
        
        # Log event
        await log_audit_event(
            user_id=user_id,
            event_type="post_created",
            details={"post_id": post["id"], "topic": post_data.topic},
            ip_address=get_client_ip(request)
        )
        
        logger.info(f"Post created for user {user_id}: {post['id']}")
        
        return PostResponse(**post)
        
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
    user_id: str,
    status_filter: Optional[PostStatus] = None,
    page: int = 1,
    page_size: int = 20
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
        
        return [PostResponse(**post) for post in result.data]
        
    except Exception as e:
        logger.error(f"Failed to list posts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve posts"
        )


@router.get("/{post_id}", response_model=PostResponse)
@limiter.limit("60/minute")
async def get_post(request: Request, post_id: str, user_id: str):
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
        
        return PostResponse(**result.data)
        
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
    user_id: str
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
        # Build update data (only include non-None fields)
        update_data = {}
        if post_update.hook is not None:
            update_data["hook"] = post_update.hook
        if post_update.caption is not None:
            update_data["caption"] = post_update.caption
        if post_update.image_url is not None:
            update_data["image_url"] = post_update.image_url
        if post_update.status is not None:
            update_data["status"] = post_update.status.value
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update data provided"
            )
        
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
        
        return PostResponse(**result.data[0])
        
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
async def delete_post(request: Request, post_id: str, user_id: str):
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
async def publish_to_linkedin(request: Request, post_id: str, user_id: str):
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
        
        # Update status to pending
        supabase_client.admin.table("posts").update({
            "status": "pending"
        }).eq("id", post_id).execute()
        
        try:
            # Post to LinkedIn
            if post["image_url"]:
                linkedin_response = await linkedin_service.post_with_image(
                    user_id=user_id,
                    text=post["caption"],
                    image_url=post["image_url"]
                )
            else:
                linkedin_response = await linkedin_service.post_text(
                    user_id=user_id,
                    text=post["caption"]
                )
            
            # Extract post ID from response
            linkedin_post_id = linkedin_response.get("id", "")
            
            # Update post status to posted
            supabase_client.admin.table("posts").update({
                "status": "posted",
                "posted_at": datetime.utcnow().isoformat(),
                "linkedin_post_id": linkedin_post_id,
                "linkedin_url": f"https://www.linkedin.com/feed/update/{linkedin_post_id}"
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
                posted_at=datetime.utcnow(),
                linkedin_url=f"https://www.linkedin.com/feed/update/{linkedin_post_id}",
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
            detail="Failed to publish post"
        )


# =============================================================================
# POST STATISTICS
# =============================================================================

@router.get("/stats/summary", response_model=dict)
@limiter.limit("60/minute")
async def get_post_stats(request: Request, user_id: str):
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
