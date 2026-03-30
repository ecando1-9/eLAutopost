"""
Content Queue Management Service.

Handles:
- Generating posts (rolling queue, 1-2 at a time, not 7)
- Topic rotation to ensure variety
- Duplicate prevention
- Queue management

Security:
- User-specific queues
- Subscription validation
- Rate limiting enforcement
- Posts saved as 'pending_review' requiring user approval
"""

from typing import List, Dict, Any, Optional
from datetime import timedelta
import random
from ..core.config import logger
from ..core.datetime_utils import utc_now
from ..services.database import supabase_client
from ..services.content_generation import ContentGenerationService
from ..services.scheduler import scheduler_service
from ..services.linkedin import linkedin_service
from ..models.schemas import ContentType
import asyncio
from datetime import datetime, timezone


class ContentQueueService:
    """
    Service for managing automated content generation and queueing.
    """

    def __init__(self):
        self.content_service = ContentGenerationService()

        # Topic categories
        self.categories = {
            "AI": [
                "Latest AI breakthroughs",
                "AI in business",
                "Machine learning trends",
                "AI ethics and safety"
            ],
            "Cybersecurity": [
                "Latest security threats",
                "Data privacy best practices",
                "Zero-trust architecture",
                "Security tools and frameworks"
            ],
            "Tech Updates": [
                "New framework releases",
                "Tech company news",
                "Developer tools",
                "Cloud computing trends"
            ],
            "Tools": [
                "Productivity tools",
                "Developer tools",
                "No-code platforms",
                "Automation tools"
            ],
            "Career": [
                "Career growth tips",
                "Interview preparation",
                "Skill development",
                "Work-life balance"
            ]
        }

    async def fill_user_queue(
        self,
        user_id: str,
        count: int = 2,  # Default: 2 posts (rolling queue, NOT 7-day bulk!)
        categories: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate posts for a user's queue using a rolling queue system.

        Posts are saved as 'pending_review' so that users must
        review and approve each post before it gets published.

        Args:
            user_id: User ID
            count: Number of posts to generate (default: 2)
            categories: Preferred categories (None = use all)

        Returns:
            List of generated posts
        """
        try:
            # Check subscription status
            has_access = await self._check_user_access(user_id)
            if not has_access:
                raise Exception("Subscription required to generate content")

            # Get user's schedule to suggest posting times
            schedule = await scheduler_service.get_user_schedule(user_id)

            # Get recent topics to avoid duplicates
            recent_topics = await self._get_recent_topics(user_id, days=7)

            generated_posts = []

            for i in range(count):
                # Select topic with rotation
                topic = await self._select_next_topic(
                    user_id=user_id,
                    categories=categories,
                    exclude_topics=recent_topics
                )

                # Generate content
                content = await self.content_service.generate_content(
                    topic=topic,
                    tone="professional"
                )

                # Calculate a suggested scheduling time
                suggested_at = None
                if schedule and schedule.get("is_active"):
                    if i == 0:
                        # Find the furthest future scheduled_at to append to the end
                        result = supabase_client.admin.table("posts").select(
                            "scheduled_at"
                        ).eq("user_id", user_id).order("scheduled_at", desc=True).limit(1).execute()
                        
                        last_post = result.data[0] if result.data else None
                        if last_post and last_post.get("scheduled_at"):
                            from datetime import datetime
                            base_time = datetime.fromisoformat(
                                last_post["scheduled_at"].replace("Z", "+00:00")
                            ).replace(tzinfo=None) + timedelta(minutes=5)
                        else:
                            # Start from tomorrow at earliest if queue is empty
                            base_time = utc_now().replace(tzinfo=None) + timedelta(days=1)
                            base_time = base_time.replace(hour=0, minute=0, second=0)

                    suggested_at = scheduler_service.calculate_next_post_time(
                        schedule,
                        current_time=base_time
                    )
                    if suggested_at:
                        # Advance base_time so next loop gets NEXT slot
                        base_time = suggested_at + timedelta(minutes=5)

                # Save as 'pending_review' — MANDATORY user approval before publishing
                post_data = {
                    "user_id": user_id,
                    "topic": topic,
                    "hook": content.hook,
                    "image_prompt": (
                        content.image_prompt
                        if getattr(content, "image_prompt", None)
                        else f"Professional LinkedIn visual for {topic}"
                    ),
                    "caption": content.caption,
                    "content_type": content.content_type.value,
                    "status": "pending_review",  # Requires user review!
                    "scheduled_at": suggested_at.isoformat() if suggested_at else None
                }

                result = supabase_client.admin.table("posts").insert(
                    post_data
                ).execute()

                if result.data:
                    generated_posts.append(result.data[0])
                    recent_topics.append(topic)

                # Increment usage metrics
                await self._increment_usage(user_id, "posts_generated")

            logger.info(
                f"Generated {len(generated_posts)} posts for user {user_id} "
                f"(status: pending_review — awaiting user approval)"
            )

            return generated_posts

        except Exception as e:
            logger.error(f"Failed to fill queue for user {user_id}: {e}")
            raise

    async def _select_next_topic(
        self,
        user_id: str,
        categories: Optional[List[str]] = None,
        exclude_topics: Optional[List[str]] = None
    ) -> str:
        """
        Select next topic with rotation logic.

        Args:
            user_id: User ID
            categories: Preferred categories
            exclude_topics: Topics to avoid (recent duplicates)

        Returns:
            Selected topic string
        """
        exclude_topics = exclude_topics or []

        # Use all categories if none specified
        if not categories:
            categories = list(self.categories.keys())

        # Get topics from selected categories
        available_topics = []
        for category in categories:
            if category in self.categories:
                available_topics.extend(self.categories[category])

        # Filter out recent topics
        available_topics = [
            t for t in available_topics
            if t not in exclude_topics
        ]

        if not available_topics:
            # If all topics used, reset and pick from all
            available_topics = []
            for category in categories:
                if category in self.categories:
                    available_topics.extend(self.categories[category])

        # Select random topic
        return random.choice(available_topics)

    async def _get_recent_topics(
        self,
        user_id: str,
        days: int = 7
    ) -> List[str]:
        """
        Get topics used in recent posts to avoid duplicates.

        Args:
            user_id: User ID
            days: Number of days to look back

        Returns:
            List of recent topics
        """
        try:
            cutoff_date = (utc_now().replace(tzinfo=None) - timedelta(days=days)).isoformat()

            result = supabase_client.admin.table("posts").select(
                "topic"
            ).eq("user_id", user_id).gte("created_at", cutoff_date).execute()

            return [post["topic"] for post in (result.data or [])]

        except Exception as e:
            logger.error(f"Failed to get recent topics for {user_id}: {e}")
            return []

    async def _check_user_access(self, user_id: str) -> bool:
        """
        Check if user has active subscription or trial.

        Args:
            user_id: User ID

        Returns:
            True if user has access, False otherwise
        """
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
        """
        Increment usage counter for user.

        Args:
            user_id: User ID
            metric: Metric to increment
        """
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

    async def get_user_queue(
        self,
        user_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get user's queued posts.

        Args:
            user_id: User ID
            status: Filter by status (draft, pending_review, scheduled, posted, failed)

        Returns:
            List of posts
        """
        try:
            query = supabase_client.admin.table("posts").select(
                "*"
            ).eq("user_id", user_id)

            # Improved sorting: scheduled items first (by date), then others by creation
            # In PostgreSQL via Supabase, we can use a complex order if needed, 
            # but for now we'll sort in Python to handle the nullable scheduled_at nicely.
            result = query.execute()
            all_posts = result.data or []

            # Background-refresh stats for recently posted items
            posted_recently = [
                p for p in all_posts 
                if p.get("status") == "posted" and p.get("linkedin_post_id")
            ]
            
            if posted_recently:
                asyncio.create_task(self._refresh_posts_engagement(user_id, posted_recently))

            # Sort primarily by created_at DESC to ensure newest items are always first
            # We handle parsing dates in Python to ensure robust sorting even if DB strings vary slightly.
            def sort_key(post):
                from ..core.datetime_utils import parse_datetime_utc
                created = post.get("created_at")
                if not created: return 0
                try:
                    return parse_datetime_utc(created).timestamp()
                except:
                    return 0
                
            all_posts.sort(key=sort_key, reverse=True)
            
            return all_posts

        except Exception as e:
            logger.error(f"Failed to get user queue for {user_id}: {e}")
            return []

    async def _refresh_posts_engagement(self, user_id: str, posts: List[Dict[str, Any]]):
        """Helper to refresh stats via LinkedIn API in the background."""
        now = utc_now()
        for post in posts:
            last_update_str = post.get("last_stats_update")
            if last_update_str:
                try:
                    from ..core.datetime_utils import parse_datetime_utc
                    last_update = parse_datetime_utc(last_update_str)
                    if last_update and (now - last_update).total_seconds() < 3600:
                        continue # Skip if updated recently
                except:
                    pass
            
            # Fetch from LinkedIn
            try:
                post_urn = post.get("linkedin_post_id")
                if not post_urn: continue
                
                stats = await linkedin_service.get_post_stats(user_id, post_urn)
                
                # Update DB
                supabase_client.admin.table("posts").update({
                    "likes_count": stats.get("likes", 0),
                    "comments_count": stats.get("comments", 0),
                    "last_stats_update": now.isoformat()
                }).eq("id", post["id"]).execute()
                
            except Exception as e:
                logger.warning(f"Failed to update background stats for post {post.get('id')}: {e}")
                continue


# Service instance
queue_service = ContentQueueService()
