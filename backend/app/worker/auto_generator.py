"""
Auto Content Generator Worker.

Runs periodically to:
- Find users with active auto-posting and auto_topic=True
- Generate 1-2 days of content (rolling queue, not 7 days at once)
- Save posts as 'pending_review' so users must approve before publishing

Security:
- Ensures users have an active subscription
- Limits how far ahead posts are generated (2 days max)
- User must review and approve before any post goes live
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

# Rolling window: only generate content this many days ahead
_DAYS_AHEAD_MAX = 2
# Only generate if fewer than this many pending/scheduled posts exist
_MIN_QUEUE_THRESHOLD = 2


class AutoGeneratorWorker:
    """
    Background worker for automatically generating content based on user schedules.
    Implements rolling queue: only generates content when queue is running low.
    Saves posts as 'pending_review' — user must approve before publishing.
    """

    async def process_auto_generation(self) -> Dict[str, int]:
        """
        Process all active schedules that need content generated.

        Returns:
            Stats: generated, skipped, failed counts
        """
        stats = {"generated": 0, "skipped": 0, "failed": 0}

        try:
            # Fetch all active schedules with auto_topic=True
            result = supabase_client.admin.table("posting_schedules").select(
                "*"
            ).eq("is_active", True).eq("auto_topic", True).execute()

            schedules = result.data or []
            logger.info(f"Auto-generator: checking {len(schedules)} active schedules")

            for schedule in schedules:
                try:
                    user_id = schedule["user_id"]

                    # Check subscription
                    has_access = await posting_worker._check_user_access(user_id)
                    if not has_access:
                        logger.warning(
                            f"User {user_id} subscription expired, skipping auto-generation"
                        )
                        stats["skipped"] += 1
                        continue

                    # Check rolling queue — skip if user already has enough pending posts
                    pending_count = await self._count_pending_posts(user_id)
                    if pending_count >= _MIN_QUEUE_THRESHOLD:
                        logger.info(
                            f"User {user_id} already has {pending_count} pending posts "
                            f"(threshold: {_MIN_QUEUE_THRESHOLD}), skipping"
                        )
                        stats["skipped"] += 1
                        continue

                    # Load max_posts_per_day from settings
                    settings_result = supabase_client.admin.table("settings").select(
                        "max_posts_per_day"
                    ).eq("user_id", user_id).limit(1).execute()

                    max_posts_per_day = 1
                    if settings_result.data:
                        max_posts_per_day = int(
                            settings_result.data[0].get("max_posts_per_day", 1) or 1
                        )

                    # Calculate posting slots for next 2 days (not 7)
                    desired_slots = self._calculate_all_slots(
                        schedule,
                        max_posts_per_day,
                        days_ahead=_DAYS_AHEAD_MAX
                    )

                    if not desired_slots:
                        stats["skipped"] += 1
                        continue

                    # Get existing scheduled/pending posts to avoid duplicates
                    now_iso = utc_now().isoformat()
                    existing_result = supabase_client.admin.table("posts").select(
                        "scheduled_at"
                    ).eq("user_id", user_id).in_(
                        "status", ["scheduled", "pending_review", "draft"]
                    ).gte("scheduled_at", now_iso).execute()

                    existing_times: List[datetime] = []
                    for row in (existing_result.data or []):
                        try:
                            dt_str = row.get("scheduled_at", "")
                            if dt_str:
                                dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                                existing_times.append(dt)
                        except Exception:
                            pass

                    # Find slots not yet covered (within ±30 min of existing post)
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

                    # Generate content for each missing slot
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

                            # Assemble final caption safely
                            hook = (generated.hook or "").strip()
                            body = (generated.caption or "").strip()
                            cta = (generated.cta or "").strip()
                            
                            # Deduplicate hook if AI included it in body
                            if body.lower().startswith(hook.lower()):
                                body = body[len(hook):].strip()
                                body = body.lstrip('.').lstrip(':').lstrip('\n').lstrip(' ')
                            
                            # Deduplicate CTA if AI included it in body
                            if cta and cta.lower() in body.lower():
                                # Try to remove CTA from the end specifically if possible
                                if body.lower().endswith(cta.lower()):
                                    body = body[:-len(cta)].strip()
                                else:
                                    # Fallback: keep cta but don't append it again
                                    cta = ""

                            # Remove existing hashtags from the end of body to prevent double-tagging
                            import re
                            # Match common hashtag patterns at the end of the text
                            body = re.sub(r'(\s*#\w+)+$', '', body).strip()
                            
                            final_caption = hook
                            if body:
                                final_caption += f"\n\n{body}"
                            if cta:
                                final_caption += f"\n\n{cta}"
                            
                            if generated.hashtags:
                                cleaned_tags = []
                                current_content = final_caption.lower()
                                for t in generated.hashtags:
                                    tag = t.strip().lstrip('#').replace('hashtag', '').replace(' ', '')
                                    if tag and f"#{tag.lower()}" not in current_content:
                                        cleaned_tags.append(f"#{tag}")
                                
                                if cleaned_tags:
                                    final_caption += "\n\n" + " ".join(cleaned_tags)

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
                                # IMPORTANT: Save as pending_review, NOT scheduled
                                # User must review and approve before post goes live
                                "status": "pending_review",
                                "content_type": generated.content_type.value
                            }

                            supabase_client.admin.table("posts").insert(post_data).execute()

                            logger.info(
                                f"Auto-generated post for user {user_id} "
                                f"at slot {slot_time.isoformat()} (pending review)"
                            )
                            stats["generated"] += 1

                        except Exception as slot_err:
                            logger.error(
                                f"Error generating post for user {user_id} "
                                f"slot {slot_time}: {slot_err}"
                            )
                            stats["failed"] += 1

                except Exception as e:
                    logger.error(
                        f"Error processing schedule {schedule.get('id')}: {e}"
                    )
                    stats["failed"] += 1

            logger.info(
                f"Auto-generation complete: {stats['generated']} generated "
                f"(pending review), {stats['skipped']} skipped, "
                f"{stats['failed']} failed"
            )

            return stats

        except Exception as e:
            logger.error(f"AutoGeneratorWorker error: {e}")
            return stats

    async def _count_pending_posts(self, user_id: str) -> int:
        """Count posts in pending_review, draft, or scheduled status."""
        try:
            result = supabase_client.admin.table("posts").select(
                "id", count="exact"
            ).eq("user_id", user_id).in_(
                "status", ["pending_review", "scheduled", "draft"]
            ).execute()

            if hasattr(result, 'count') and result.count is not None:
                return result.count
            return len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"Failed to count pending posts for {user_id}: {e}")
            return 0

    def _calculate_all_slots(
        self,
        schedule: Dict[str, Any],
        max_posts_per_day: int,
        days_ahead: int = _DAYS_AHEAD_MAX
    ) -> List[datetime]:
        """
        Calculate all desired posting slots for the next `days_ahead` days.
        Limited to 2 days ahead (rolling queue, not 7-day bulk generation).

        Distributes max_posts_per_day posts across the day at equal intervals
        around the user's preferred posting time with +-2 min jitter per slot.

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
            try:
                anchor_hour = int(parts[0])
                anchor_minute = int(parts[1]) if len(parts) > 1 else 0
            except (ValueError, IndexError):
                anchor_hour, anchor_minute = 9, 0
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
        spread_hours = max(1, min(max_posts_per_day - 1, 4)) * 3  # Max 12-hour span
        if max_posts_per_day <= 1:
            offsets_hours = [0]
        else:
            step = spread_hours / (max_posts_per_day - 1)
            offsets_hours = [step * i for i in range(max_posts_per_day)]

        for day_offset in range(days_ahead):
            candidate_date = now_local.date() + timedelta(days=day_offset)
            if candidate_date.weekday() not in scheduled_weekdays:
                continue

            for offset_h in offsets_hours:
                total_minutes = anchor_hour * 60 + anchor_minute + int(offset_h * 60)
                slot_hour = (total_minutes // 60) % 24
                slot_minute = total_minutes % 60

                # Add tiny jitter (+-2 min) to appear human-like
                jitter = random.randint(-2, 2)
                slot_naive = datetime.combine(
                    candidate_date,
                    time(slot_hour, slot_minute)
                ) + timedelta(minutes=jitter)

                try:
                    slot_local = user_tz.localize(slot_naive, is_dst=None)
                except Exception:
                    slot_local = user_tz.localize(slot_naive, is_dst=False)

                # Only include future slots (at least 5 minutes from now)
                slot_utc = slot_local.astimezone(pytz.UTC)
                if slot_utc > now_utc + timedelta(minutes=5):
                    slots.append(slot_utc)

        return slots


auto_generator_worker = AutoGeneratorWorker()
