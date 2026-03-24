"""
Auto Content Generator Worker.

Runs periodically to:
- Find users with active auto-posting and auto-topic generation
- Determine if they need a new post generated for their next scheduled slot
- Generate the content and save it as a scheduled post

Security:
- Ensures users have an active subscription
- Respects rate limits or limits batch processing
"""

from typing import List, Dict, Any
import random
from ..core.config import logger
from ..core.datetime_utils import utc_now
from ..services.database import supabase_client
from ..services.scheduler import scheduler_service
from ..services.content_generation import content_service
from .posting import posting_worker


class AutoGeneratorWorker:
    """
    Background worker for automatically generating content based on user schedules.
    """
    
    async def process_auto_generation(self) -> Dict[str, int]:
        """
        Process all active schedules that need content generated.
        
        Returns:
            Stats: generated, skipped counts
        """
        stats = {"generated": 0, "skipped": 0, "failed": 0}
        
        try:
            # 1. Fetch all active schedules with auto_topic=True
            result = supabase_client.admin.table("posting_schedules").select(
                "*"
            ).eq("is_active", True).eq("auto_topic", True).execute()
            
            schedules = result.data or []
            logger.info(f"Found {len(schedules)} active schedules for auto-generation")
            
            for schedule in schedules:
                try:
                    user_id = schedule["user_id"]
                    
                    # 2. Check if user has active subscription
                    has_access = await posting_worker._check_user_access(user_id)
                    if not has_access:
                        logger.warning(f"User {user_id} subscription expired, skipping auto-generation")
                        stats["skipped"] += 1
                        continue
                        
                    # 3. Check if user already has sufficient scheduled posts
                    # To keep it simple, we generate if they have 0 upcoming scheduled posts
                    now = utc_now().isoformat()
                    scheduled_posts_result = supabase_client.admin.table("posts").select(
                        "id"
                    ).eq("user_id", user_id).eq("status", "scheduled").gte("scheduled_at", now).execute()
                    
                    upcoming_posts = scheduled_posts_result.data or []
                    
                    # If they already have a post queued, skip
                    if len(upcoming_posts) > 0:
                        stats["skipped"] += 1
                        continue
                        
                    # 4. Calculate next posting time
                    next_post_time = scheduler_service.calculate_next_post_time(schedule)
                    if not next_post_time:
                        stats["skipped"] += 1
                        continue
                        
                    # 5. Determine Topic
                    categories = schedule.get("categories", [])
                    if categories:
                        topic = random.choice(categories)
                    else:
                        topic = "General Industry Insights"
                        
                    # 6. Generate Content
                    generated = await content_service.generate_content(
                        topic=topic,
                        goal="Authority",
                        audience="General professionals",
                        style="Text post",  # Or could use Carousel
                        tone="professional"
                    )
                    
                    # 7. Add to posts table
                    # Create the final caption combining caption, cta, and hashtags
                    final_caption = generated.caption
                    if generated.cta:
                        final_caption += f"\n\n{generated.cta}"
                    if generated.hashtags:
                        final_caption += "\n\n" + " ".join([f"#{t}" for t in generated.hashtags])
                        
                    post_data = {
                        "user_id": user_id,
                        "topic": topic,
                        "hook": generated.hook,
                        "image_prompt": (
                            generated.image_prompt
                            if getattr(generated, "image_prompt", None)
                            else f"Professional LinkedIn visual for {topic}"
                        ),
                        "caption": final_caption,
                        "scheduled_at": next_post_time.isoformat(),
                        "status": "scheduled",
                        "content_type": generated.content_type.value
                    }
                    
                    supabase_client.admin.table("posts").insert(post_data).execute()
                    
                    logger.info(f"Auto-generated post for user {user_id} scheduled at {next_post_time}")
                    stats["generated"] += 1
                    
                except Exception as e:
                    logger.error(f"Error auto-generating for schedule {schedule.get('id')}: {e}")
                    stats["failed"] += 1
                    
            logger.info(
                f"Auto-generation complete: {stats['generated']} generated, "
                f"{stats['skipped']} skipped, {stats['failed']} failed"
            )
            
            return stats
            
        except Exception as e:
            logger.error(f"AutoGeneratorWorker error: {e}")
            return stats

auto_generator_worker = AutoGeneratorWorker()
