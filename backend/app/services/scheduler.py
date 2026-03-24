"""
Auto-Posting Scheduler Service.

Handles:
- Calculating next posting slots based on user preferences
- Managing timezone conversions
- Adding human-like randomness to posting times
- Scheduling background jobs

Security:
- All times stored in UTC
- Timezone validation
- User-specific scheduling
"""

from datetime import datetime, time, timedelta
from typing import Optional, List, Dict, Any
import pytz
import random
from ..core.config import logger
from ..services.database import supabase_client


class SchedulerService:
    """
    Service for managing automated posting schedules.
    """
    
    def calculate_next_post_time(
        self,
        user_schedule: Dict[str, Any],
        current_time: Optional[datetime] = None
    ) -> Optional[datetime]:
        """
        Calculate the next posting time based on user's schedule.
        
        Args:
            user_schedule: User's posting schedule configuration
            current_time: Current time (defaults to now)
            
        Returns:
            Next posting time in UTC, or None if scheduling is disabled
        """
        if not user_schedule.get("is_active"):
            return None
        
        if current_time is None:
            current_time = datetime.utcnow()
        
        # Get user's timezone
        user_tz = pytz.timezone(user_schedule.get("timezone", "Asia/Kolkata"))
        
        # Convert current time to user's timezone
        current_local = current_time.replace(tzinfo=pytz.UTC).astimezone(user_tz)
        
        # Get posting time
        post_time = user_schedule.get("time_of_day")  # time object
        if isinstance(post_time, str):
            # Parse time string (HH:MM:SS or HH:MM)
            time_parts = post_time.split(":")
            post_time = time(
                hour=int(time_parts[0]),
                minute=int(time_parts[1]) if len(time_parts) > 1 else 0
            )
        
        # Get days of week (e.g., ['MON', 'WED', 'FRI'])
        days_of_week = user_schedule.get("days_of_week", [])
        if not days_of_week:
            return None
        
        # Map day names to weekday numbers
        day_map = {
            'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3,
            'FRI': 4, 'SAT': 5, 'SUN': 6
        }
        
        scheduled_weekdays = [day_map[d] for d in days_of_week if d in day_map]
        
        # Find next scheduled day
        next_post_local = None
        for days_ahead in range(8):  # Check next 7 days
            candidate_date = current_local.date() + timedelta(days=days_ahead)
            candidate_weekday = candidate_date.weekday()
            
            if candidate_weekday in scheduled_weekdays:
                candidate_datetime = datetime.combine(
                    candidate_date,
                    post_time,
                    tzinfo=user_tz
                )
                
                # If it's today, make sure time hasn't passed
                if days_ahead == 0 and candidate_datetime <= current_local:
                    continue
                
                next_post_local = candidate_datetime
                break
        
        if next_post_local is None:
            return None
        
        # Add human-like randomness if enabled (±10-20 minutes)
        # This makes posting appear more natural
        random_minutes = random.randint(-20, 20)
        next_post_local += timedelta(minutes=random_minutes)
        
        # Convert back to UTC
        next_post_utc = next_post_local.astimezone(pytz.UTC).replace(tzinfo=None)
        
        return next_post_utc
    
    async def get_user_schedule(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user's posting schedule from database.
        
        Args:
            user_id: User ID
            
        Returns:
            Schedule configuration or None
        """
        try:
            result = supabase_client.admin.table("posting_schedules").select(
                "*"
            ).eq("user_id", user_id).limit(1).execute()
            
            if not result.data:
                return None

            return result.data[0]
            
        except Exception as e:
            logger.error(f"Failed to get user schedule: {e}")
            return None
    
    async def update_user_schedule(
        self,
        user_id: str,
        days_of_week: List[str],
        time_of_day: str,
        timezone: str = "Asia/Kolkata",
        is_active: bool = True,
        categories: Optional[List[str]] = None,
        auto_topic: bool = True
    ) -> Dict[str, Any]:
        """
        Update or create user's posting schedule.
        
        Args:
            user_id: User ID
            days_of_week: List of days (e.g., ['MON', 'WED', 'FRI'])
            time_of_day: Posting time (HH:MM format)
            timezone: User's timezone
            is_active: Whether scheduling is enabled
            categories: Preferred content categories
            auto_topic: Whether to auto-select trending topics
            
        Returns:
            Updated schedule data
        """
        try:
            # Validate timezone
            try:
                pytz.timezone(timezone)
            except Exception:
                timezone = "Asia/Kolkata"  # Default to IST
            
            schedule_data = {
                "user_id": user_id,
                "days_of_week": days_of_week,
                "time_of_day": time_of_day,
                "timezone": timezone,
                "is_active": is_active,
                "categories": categories or [],
                "auto_topic": auto_topic
            }
            
            # Upsert schedule
            result = supabase_client.admin.table("posting_schedules").upsert(
                schedule_data,
                on_conflict="user_id"
            ).execute()
            
            logger.info(f"Updated schedule for user {user_id}")
            
            return result.data[0] if result.data else {}
            
        except Exception as e:
            logger.error(f"Failed to update schedule: {e}")
            raise Exception("Failed to update posting schedule")
    
    async def get_due_posts(self) -> List[Dict[str, Any]]:
        """
        Get all posts that are scheduled and due for posting.
        
        Returns:
            List of posts ready to be posted
        """
        try:
            now = datetime.utcnow().isoformat()
            
            result = supabase_client.admin.table("posts").select(
                "*"
            ).eq("status", "scheduled").lte("scheduled_at", now).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Failed to get due posts: {e}")
            return []


# Service instance
scheduler_service = SchedulerService()
