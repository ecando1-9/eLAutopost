"""
Auto Content Generator Worker.

Runs periodically to:
- Find users with active auto-posting and auto-topic generation
- Determine how many posts are needed per day (max_posts_per_day from settings)
- Calculate all scheduled slots for the day based on schedule settings
- Generate the content at each slot and save as a scheduled post

Security:
- Ensures users have an active subscription
- Respects rate limits or limits batch processing
"""

from typing import List, Dict, Any, Optional
import random
from datetime import datetime, time, timedelta
from ..core.config import logger
from ..core.datetime_utils import utc_now
from ..services.database import supabase_client
from ..services.scheduler import scheduler_service
from ..services.content_generation import content_service
from .posting import posting_worker
import pytz


class AutoGeneratorWorker:
    """
    Background worker for automatically generating content based on user schedules.
    Respects max_posts_per_day and fills all scheduled time slots for each day.
    """

    async def process_auto_generation(self) -> Dict[str, int]:
        """
        Process all active schedules that need content generated.

        Returns:
            Stats: generated, skipped, failed counts
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
                        logger.warning(
                            f"User {user_id} subscription expired, skipping auto-generation"
                        )
                        stats["skipped"] += 1
                        continue

                    # 3. Load user settings to get max_posts_per_day
                    settings_result = supabase_client.admin.table("settings").select(
                        "max_posts_per_day"
                    ).eq("user_id", user_id).limit(1).execute()

                    max_posts_per_day = 1
                    if settings_result.data:
                        max_posts_per_day = int(
                            settings_result.data[0].get("max_posts_per_day", 1) or 1
                        )

                    # 4. Calculate all desired slot times for the next 7 days
                    desired_slots = self._calculate_all_slots(schedule, max_posts_per_day)

                    if not desired_slots:
                        stats["skipped"] += 1
                        continue

                    # 5. Get existing scheduled posts to avoid duplicates
                    now_iso = utc_now().isoformat()
                    existing_result = supabase_client.admin.table("posts").select(
                        "scheduled_at"
                    ).eq("user_id", user_id).eq("status", "scheduled").gte(
                        "scheduled_at", now_iso
                    ).execute()

                    existing_times: List[datetime] = []
                    for row in (existing_result.data or []):
                        try:
                            dt_str = row["scheduled_at"]
                            # Parse UTC datetime
                            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                            existing_times.append(dt)
                        except Exception:
                            pass

                    # 6. Find slots that are not yet covered (within ±30 min of existing post)
                    missing_slots = []
                    for slot in desired_slots:
                        already_covered = any(
                            abs((slot - et).total_seconds()) < 1800
                            for et in existing_times
                        )
                        if not already_covered:
                            missing_slots.append(slot)

                    if not missing_slots:
                        logger.info(f"User {user_id}: all slots already filled")
                        stats["skipped"] += 1
                        continue

                    # 7. Generate a post for each missing slot
                    categories = schedule.get("categories") or []
                    for slot_time in missing_slots:
                        try:
                            topic = random.choice(categories) if categories else "General Industry Insights"

                            generated = await content_service.generate_content(
                                topic=topic,
                                goal="Authority",
                                audience="General professionals",
                                style="Text post",
                                tone="professional"
                            )

                            final_caption = generated.caption
                            if generated.cta:
                                final_caption += f"\n\n{generated.cta}"
                            if generated.hashtags:
                                final_caption += "\n\n" + " ".join(
                                    [f"#{t}" for t in generated.hashtags]
                                )

                            post_data = {
                                "user_id": user_id,
                                "topic": topic,
                                "hook": generated.hook,
                                "image_prompt": (
                                    getattr(generated, "image_prompt", None)
                                    or f"Professional LinkedIn visual for {topic}"
                                ),
                                "caption": final_caption,
                                "scheduled_at": slot_time.isoformat(),
                                "status": "scheduled",
                                "content_type": generated.content_type.value
                            }

                            supabase_client.admin.table("posts").insert(post_data).execute()

                            logger.info(
                                f"Auto-generated post for user {user_id} "
                                f"at slot {slot_time.isoformat()}"
                            )
                            stats["generated"] += 1

                        except Exception as slot_err:
                            logger.error(
                                f"Error generating post for user {user_id} slot {slot_time}: {slot_err}"
                            )
                            stats["failed"] += 1

                except Exception as e:
                    logger.error(
                        f"Error auto-generating for schedule {schedule.get('id')}: {e}"
                    )
                    stats["failed"] += 1

            logger.info(
                f"Auto-generation complete: {stats['generated']} generated, "
                f"{stats['skipped']} skipped, {stats['failed']} failed"
            )

            return stats

        except Exception as e:
            logger.error(f"AutoGeneratorWorker error: {e}")
            return stats

    def _calculate_all_slots(
        self,
        schedule: Dict[str, Any],
        max_posts_per_day: int,
        days_ahead: int = 7
    ) -> List[datetime]:
        """
        Calculate all desired posting slots for the next `days_ahead` days.

        Distributes `max_posts_per_day` posts across the day at equal intervals
        around the user's preferred posting time with ±0-10 min randomness per slot.

        Returns a list of UTC datetime objects.
        """
        if not schedule.get("is_active"):
            return []

        try:
            user_tz = pytz.timezone(schedule.get("timezone", "Asia/Kolkata"))
        except Exception:
            user_tz = pytz.timezone("Asia/Kolkata")

        # Parse preferred posting time (anchor time)
        time_str = schedule.get("time_of_day", "09:00")
        if isinstance(time_str, str):
            parts = time_str.split(":")
            anchor_hour = int(parts[0])
            anchor_minute = int(parts[1]) if len(parts) > 1 else 0
        else:
            anchor_hour, anchor_minute = 9, 0

        # Map days of week
        day_map = {
            'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3,
            'FRI': 4, 'SAT': 5, 'SUN': 6
        }
        schedule_days = schedule.get("days_of_week", [])
        scheduled_weekdays = {day_map[d] for d in schedule_days if d in day_map}

        if not scheduled_weekdays:
            return []

        now_utc = utc_now()
        now_local = now_utc.replace(tzinfo=pytz.UTC).astimezone(user_tz)

        slots: List[datetime] = []

        # Spread posts across the working day: from anchor to anchor + spread window
        # If 3 posts/day with anchor 09:00: slots at ~09:00, ~12:00, ~15:00
        spread_hours = max(1, min(max_posts_per_day - 1, 4)) * 3  # Max 4 extra slots = 12 hours span
        if max_posts_per_day <= 1:
            offsets_hours = [0]
        else:
            step = spread_hours / (max_posts_per_day - 1) if max_posts_per_day > 1 else 0
            offsets_hours = [step * i for i in range(max_posts_per_day)]

        for day_offset in range(days_ahead):
            candidate_date = now_local.date() + timedelta(days=day_offset)
            if candidate_date.weekday() not in scheduled_weekdays:
                continue

            for offset_h in offsets_hours:
                total_minutes = anchor_hour * 60 + anchor_minute + int(offset_h * 60)
                slot_hour = (total_minutes // 60) % 24
                slot_minute = total_minutes % 60

                # Add ±10 min randomness
                jitter = random.randint(-10, 10)
                slot_naive = datetime.combine(
                    candidate_date,
                    time(slot_hour, slot_minute)
                ) + timedelta(minutes=jitter)

                try:
                    slot_local = user_tz.localize(slot_naive, is_dst=None)
                except Exception:
                    slot_local = user_tz.localize(slot_naive, is_dst=True)

                # Only include future slots (at least 5 minutes from now)
                slot_utc = slot_local.astimezone(pytz.UTC)
                if slot_utc > now_utc + timedelta(minutes=5):
                    slots.append(slot_utc)

        return slots


auto_generator_worker = AutoGeneratorWorker()
