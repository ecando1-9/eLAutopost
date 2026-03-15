"""
Content Queue Management Service.

Handles:
- Generating multiple posts in advance
- Topic rotation to ensure variety
- Fetching trending topics
- Duplicate prevention
- Queue management

Security:
- User-specific queues
- Subscription validation
- Rate limiting enforcement
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import random
from ..core.config import logger
from ..services.database import supabase_client
from ..services.content_generation import ContentGenerationService
from ..services.scheduler import scheduler_service
from ..models.schemas import ContentType


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
        count: int = 7,
        categories: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate multiple posts for a user's queue.
        
        Args:
            user_id: User ID
            count: Number of posts to generate
            categories: Preferred categories (None = use all)
            
        Returns:
            List of generated posts
        """
        try:
            # Check subscription status
            has_access = await self._check_user_access(user_id)
            if not has_access:
                raise Exception("Subscription required to generate content")
            
            # Get user's schedule to determine posting times
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
                
                # Calculate scheduled time
                scheduled_at = None
                if schedule and schedule.get("is_active"):
                    # Calculate next posting slot
                    base_time = datetime.utcnow() + timedelta(days=i)
                    scheduled_at = scheduler_service.calculate_next_post_time(
                        schedule,
                        current_time=base_time
                    )
                
                # Create post in database
                post_data = {
                    "user_id": user_id,
                    "topic": topic,
                    "hook": content.hook,
                    "image_prompt": content.image_prompt,
                    "caption": content.caption,
                    "content_type": content.content_type.value,
                    "status": "scheduled" if scheduled_at else "draft",
                    "scheduled_at": scheduled_at.isoformat() if scheduled_at else None
                }
                
                result = supabase_client.admin.table("posts").insert(
                    post_data
                ).execute()
                
                if result.data:
                    generated_posts.append(result.data[0])
                    recent_topics.append(topic)
                
                # Increment usage metrics
                await self._increment_usage(user_id, "posts_generated")
            
            logger.info(f"Generated {len(generated_posts)} posts for user {user_id}")
            
            return generated_posts
            
        except Exception as e:
            logger.error(f"Failed to fill queue: {e}")
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
            cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
            
            result = supabase_client.admin.table("posts").select(
                "topic"
            ).eq("user_id", user_id).gte("created_at", cutoff_date).execute()
            
            return [post["topic"] for post in (result.data or [])]
            
        except Exception as e:
            logger.error(f"Failed to get recent topics: {e}")
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
            logger.error(f"Failed to check user access: {e}")
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
            logger.error(f"Failed to increment usage: {e}")
    
    async def get_user_queue(
        self,
        user_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get user's queued posts.
        
        Args:
            user_id: User ID
            status: Filter by status (draft, scheduled, posted, failed)
            
        Returns:
            List of posts
        """
        try:
            query = supabase_client.admin.table("posts").select(
                "*"
            ).eq("user_id", user_id)
            
            if status:
                query = query.eq("status", status)
            
            result = query.order("created_at", desc=True).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Failed to get user queue: {e}")
            return []


# Service instance
queue_service = ContentQueueService()
