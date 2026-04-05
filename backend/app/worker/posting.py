"""
Background Posting Worker.

Runs periodically to:
- Find posts due for posting
- Mark post as 'running' before attempting (prevents double-posting)
- Post to LinkedIn
- Handle retries with exponential backoff
- Update post status (running -> posted/failed)

Security:
- Rate limiting
- Retry with exponential backoff
- Error logging without sensitive detail exposure
- User access validation
- 'running' status prevents duplicate posts if worker runs concurrently
"""

from typing import List, Dict, Any
from datetime import timedelta
from ..core.config import logger
from ..core.datetime_utils import utc_now
from ..core.text_utils import strip_markdown_formatting
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

        Steps:
        1. Fetch all 'scheduled' posts with scheduled_at <= now
        2. Mark each post as 'running' immediately (atomic, prevents double-post)
        3. Validate user subscription
        4. Post to LinkedIn
        5. Mark as 'posted' or increment retry / mark 'failed'

        Returns:
            Stats: posted, failed, skipped counts
        """
        stats = {"posted": 0, "failed": 0, "skipped": 0}

        try:
            # Get all posts due for posting (only 'scheduled' status)
            due_posts = await scheduler_service.get_due_posts()

            if not due_posts:
                return stats

            # Group posts by user_id to prevent multi-posting spam for the same user
            # if a backlog has built up (e.g. from server sleep).
            user_post_map: Dict[str, Dict[str, Any]] = {}

            for post in due_posts:
                uid = post.get("user_id")
                # Store only the first/oldest due post per user, skip the rest for this cycle
                if uid and uid not in user_post_map:
                    user_post_map[uid] = post

            posts_to_process = list(user_post_map.values())

            logger.info(
                f"Processing {len(posts_to_process)} due posts (from {len(due_posts)} total backlog "
                f"across {len(user_post_map)} users)"
            )

            for post in posts_to_process:
                post_id = post.get("id")
                try:
                    # CRITICAL: Mark post as 'running' BEFORE any processing
                    # This prevents a second worker instance from picking it up
                    marked = await self._mark_running(post_id)
                    if not marked:
                        # Another worker already claimed this post
                        logger.info(f"Post {post_id} already claimed by another worker, skipping")
                        stats["skipped"] += 1
                        continue

                    # Check if user has active subscription
                    has_access = await self._check_user_access(post["user_id"])
                    if not has_access:
                        logger.warning(
                            f"User {post['user_id']} subscription expired, "
                            f"skipping post {post_id}"
                        )
                        await self._mark_failed(
                            post_id,
                            "Subscription expired or inactive"
                        )
                        stats["skipped"] += 1
                        continue

                    # Attempt to post to LinkedIn
                    success = await self._post_to_linkedin(post)

                    if success:
                        stats["posted"] += 1
                    else:
                        stats["failed"] += 1

                except Exception as e:
                    logger.error(f"Error processing post {post_id}: {e}")
                    # Ensure post doesn't stay stuck in 'running' state
                    try:
                        await self._mark_failed(post_id, f"Worker error: {str(e)[:200]}")
                    except Exception:
                        pass
                    stats["failed"] += 1

            logger.info(
                f"Posting complete: {stats['posted']} posted, "
                f"{stats['failed']} failed, {stats['skipped']} skipped"
            )

            return stats

        except Exception as e:
            logger.error(f"PostingWorker error: {e}")
            return stats

    async def _mark_running(self, post_id: str) -> bool:
        """
        Atomically mark a post as 'running'.
        Returns True if we successfully claimed it, False if already claimed.
        """
        try:
            result = supabase_client.admin.table("posts").update({
                "status": "running"
            }).eq("id", post_id).eq("status", "scheduled").execute()

            # If no rows updated, post was already claimed / changed status
            return bool(result.data)
        except Exception as e:
            logger.error(f"Failed to mark post {post_id} as running: {e}")
            return False

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
            clean_caption = strip_markdown_formatting(post["caption"])

            # Post to LinkedIn
            result = await linkedin_service.create_post(
                user_id=user_id,
                text=clean_caption,
                image_url=post.get("image_url"),
                target=post.get("target"),
                organization_id=post.get("organization_id")
            )

            if result.get("success"):
                # Mark as posted
                await self._mark_posted(
                    post_id=post_id,
                    caption=clean_caption,
                    linkedin_post_id=result.get("post_id"),
                    linkedin_url=result.get("post_url")
                )

                # Increment usage
                await self._increment_usage(user_id, "linkedin_posts")

                logger.info(f"Successfully posted {post_id} to LinkedIn")
                return True
            else:
                raise Exception(result.get("error", "Unknown LinkedIn error"))

        except Exception as e:
            logger.error(f"LinkedIn posting failed for {post_id}: {e}")

            # Retry logic
            if retry_count < self.MAX_RETRIES:
                # Reschedule with exponential backoff: 5, 10, 20 minutes
                backoff_minutes = 5 * (2 ** retry_count)
                retry_at = utc_now() + timedelta(minutes=backoff_minutes)

                await self._increment_retry(post_id, retry_at)
                logger.info(
                    f"Retrying post {post_id} in {backoff_minutes} min "
                    f"(attempt {retry_count + 1}/{self.MAX_RETRIES})"
                )
                return False
            else:
                # Max retries reached, mark as failed
                await self._mark_failed(post_id, str(e)[:500])
                logger.error(
                    f"Post {post_id} failed after {self.MAX_RETRIES} retries: {e}"
                )
                return False

    async def _mark_posted(
        self,
        post_id: str,
        caption: str,
        linkedin_post_id: str,
        linkedin_url: str
    ):
        """Mark post as successfully posted."""
        try:
            supabase_client.admin.table("posts").update({
                "status": "posted",
                "caption": caption,
                "posted_at": utc_now().isoformat(),
                "linkedin_post_id": linkedin_post_id,
                "linkedin_url": linkedin_url,
                "error_message": None
            }).eq("id", post_id).execute()
        except Exception as e:
            logger.error(f"Failed to mark post {post_id} as posted: {e}")

    async def _mark_failed(self, post_id: str, error_message: str):
        """Mark post as failed."""
        try:
            supabase_client.admin.table("posts").update({
                "status": "failed",
                "error_message": error_message
            }).eq("id", post_id).execute()
        except Exception as e:
            logger.error(f"Failed to mark post {post_id} as failed: {e}")

    async def _increment_retry(self, post_id: str, retry_at=None):
        """Increment retry count and reschedule the post with backoff."""
        try:
            # Get current retry count
            result = supabase_client.admin.table("posts").select(
                "retry_count"
            ).eq("id", post_id).single().execute()

            current_count = result.data.get("retry_count", 0) if result.data else 0

            update_data = {
                "retry_count": current_count + 1,
                "status": "scheduled",  # Back to scheduled for retry
            }
            if retry_at:
                update_data["scheduled_at"] = retry_at.isoformat()

            supabase_client.admin.table("posts").update(
                update_data
            ).eq("id", post_id).execute()

        except Exception as e:
            logger.error(f"Failed to increment retry count for {post_id}: {e}")

    async def _check_user_access(self, user_id: str) -> bool:
        """Check if user has active subscription."""
        try:
            result = supabase_client.admin.rpc(
                "has_active_subscription",
                {"check_user_id": user_id}
            ).execute()

            return result.data if result.data is not None else False

        except Exception as e:
            logger.error(f"Failed to check user access for {user_id}: {e}")
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
            logger.error(f"Failed to increment usage for {user_id}: {e}")


# Worker instance
posting_worker = PostingWorker()
