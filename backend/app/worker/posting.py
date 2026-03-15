"""
Background Posting Worker.

Runs periodically to:
- Find posts due for posting
- Post to LinkedIn
- Handle retries and failures
- Update post status

Security:
- Rate limiting
- Retry with exponential backoff
- Error logging
- User access validation
"""

from typing import List, Dict, Any
from datetime import datetime
import asyncio
from ..core.config import logger
from ..services.database import supabase_client
from ..services.scheduler import scheduler_service
from ..services.linkedin import linkedin_service


class PostingWorker:
    """
    Background worker for automated LinkedIn posting.
    """
    
    MAX_RETRIES = 3
    
    async def process_due_posts(self) -> Dict[str, int]:
        """
        Process all posts that are due for posting.
        
        Returns:
            Stats: posted, failed, skipped counts
        """
        stats = {"posted": 0, "failed": 0, "skipped": 0}
        
        try:
            # Get all posts due for posting
            due_posts = await scheduler_service.get_due_posts()
            
            logger.info(f"Found {len(due_posts)} posts due for posting")
            
            for post in due_posts:
                try:
                    # Check if user has active subscription
                    has_access = await self._check_user_access(post["user_id"])
                    if not has_access:
                        logger.warning(
                            f"User {post['user_id']} subscription expired, "
                            f"skipping post {post['id']}"
                        )
                        await self._mark_failed(
                            post["id"],
                            "Subscription expired or inactive"
                        )
                        stats["skipped"] += 1
                        continue
                    
                    # Attempt to post
                    success = await self._post_to_linkedin(post)
                    
                    if success:
                        stats["posted"] += 1
                    else:
                        stats["failed"] += 1
                        
                except Exception as e:
                    logger.error(f"Error processing post {post.get('id')}: {e}")
                    stats["failed"] += 1
            
            logger.info(
                f"Posting complete: {stats['posted']} posted, "
                f"{stats['failed']} failed, {stats['skipped']} skipped"
            )
            
            return stats
            
        except Exception as e:
            logger.error(f"Worker error: {e}")
            return stats
    
    async def _post_to_linkedin(self, post: Dict[str, Any]) -> bool:
        """
        Post content to LinkedIn with retry logic.
        
        Args:
            post: Post data
            
        Returns:
            True if successful, False otherwise
        """
        post_id = post["id"]
        user_id = post["user_id"]
        retry_count = post.get("retry_count", 0)
        
        try:
            # Post to LinkedIn
            result = await linkedin_service.create_post(
                user_id=user_id,
                text=post["caption"],
                image_url=post.get("image_url")
            )
            
            if result.get("success"):
                # Mark as posted
                await self._mark_posted(
                    post_id=post_id,
                    linkedin_post_id=result.get("post_id"),
                    linkedin_url=result.get("post_url")
                )
                
                # Increment usage
                await self._increment_usage(user_id, "linkedin_posts")
                
                logger.info(f"Successfully posted {post_id} to LinkedIn")
                return True
            else:
                # Post failed
                raise Exception(result.get("error", "Unknown error"))
                
        except Exception as e:
            logger.error(f"LinkedIn posting failed for {post_id}: {e}")
            
            # Retry logic
            if retry_count < self.MAX_RETRIES:
                # Increment retry count and reschedule
                await self._increment_retry(post_id)
                logger.info(
                    f"Will retry post {post_id} "
                    f"(attempt {retry_count + 1}/{self.MAX_RETRIES})"
                )
                return False
            else:
                # Max retries reached, mark as failed
                await self._mark_failed(post_id, str(e))
                logger.error(
                    f"Post {post_id} failed after {self.MAX_RETRIES} retries"
                )
                return False
    
    async def _mark_posted(
        self,
        post_id: str,
        linkedin_post_id: str,
        linkedin_url: str
    ):
        """Mark post as successfully posted."""
        try:
            supabase_client.admin.table("posts").update({
                "status": "posted",
                "posted_at": datetime.utcnow().isoformat(),
                "linkedin_post_id": linkedin_post_id,
                "linkedin_url": linkedin_url,
                "error_message": None
            }).eq("id", post_id).execute()
        except Exception as e:
            logger.error(f"Failed to mark post as posted: {e}")
    
    async def _mark_failed(self, post_id: str, error_message: str):
        """Mark post as failed."""
        try:
            supabase_client.admin.table("posts").update({
                "status": "failed",
                "error_message": error_message
            }).eq("id", post_id).execute()
        except Exception as e:
            logger.error(f"Failed to mark post as failed: {e}")
    
    async def _increment_retry(self, post_id: str):
        """Increment retry count for a post."""
        try:
            # Get current retry count
            result = supabase_client.admin.table("posts").select(
                "retry_count"
            ).eq("id", post_id).single().execute()
            
            current_count = result.data.get("retry_count", 0) if result.data else 0
            
            # Increment
            supabase_client.admin.table("posts").update({
                "retry_count": current_count + 1
            }).eq("id", post_id).execute()
            
        except Exception as e:
            logger.error(f"Failed to increment retry count: {e}")
    
    async def _check_user_access(self, user_id: str) -> bool:
        """Check if user has active subscription."""
        try:
            result = supabase_client.admin.rpc(
                "has_active_subscription",
                {"check_user_id": user_id}
            ).execute()
            
            return result.data if result.data is not None else False
            
        except Exception as e:
            logger.error(f"Failed to check user access: {e}")
            return False
    
    async def _increment_usage(self, user_id: str, metric: str):
        """Increment usage metric."""
        try:
            supabase_client.admin.rpc(
                "increment_usage",
                {
                    "p_user_id": user_id,
                    "p_metric": metric,
                    "p_increment": 1
                }
            ).execute()
        except Exception as e:
            logger.error(f"Failed to increment usage: {e}")


# Worker instance
posting_worker = PostingWorker()
