"""
Auto Content Generator Worker.

Runs periodically to:
- Find users with active auto-posting and auto_topic=True
- Generate 1-2 days of content against the exact saved schedule slots
- Create scheduled posts that the posting worker can publish on time
"""

from typing import List, Dict, Any
from datetime import datetime, time, timedelta

import pytz

from ..core.config import logger
from ..core.datetime_utils import utc_now, parse_datetime_utc
from ..services.automation_defaults import (
    build_generation_instructions,
    build_target_variants,
    build_topic_from_category,
    compose_linkedin_caption,
    load_user_automation_settings,
)
from ..services.content_generation import content_service
from ..services.database import supabase_client
from .posting import posting_worker


_DAYS_AHEAD_MAX = 2


class AutoGeneratorWorker:
    """Generate scheduled content that follows each user's saved settings."""

    async def process_auto_generation(self) -> Dict[str, int]:
        """Process all active schedules that need content generated."""
        stats = {"generated": 0, "skipped": 0, "failed": 0}

        try:
            result = supabase_client.admin.table("posting_schedules").select(
                "*"
            ).eq("is_active", True).eq("auto_topic", True).execute()

            schedules = result.data or []
            logger.info(f"Auto-generator: checking {len(schedules)} active schedules")

            for schedule in schedules:
                try:
                    user_stats = await self.process_user_auto_generation(
                        user_id=schedule["user_id"],
                        schedule=schedule,
                    )
                    for key in stats:
                        stats[key] += user_stats.get(key, 0)
                except Exception as e:
                    logger.error(f"Error processing schedule {schedule.get('id')}: {e}")
                    stats["failed"] += 1

            logger.info(
                f"Auto-generation complete: {stats['generated']} generated "
                f"(scheduled), {stats['skipped']} skipped, {stats['failed']} failed"
            )
            return stats
        except Exception as e:
            logger.error(f"AutoGeneratorWorker error: {e}")
            return stats

    async def process_user_auto_generation(
        self,
        user_id: str,
        schedule: Dict[str, Any] | None = None,
    ) -> Dict[str, int]:
        """Generate upcoming scheduled posts for a single user."""
        stats = {"generated": 0, "skipped": 0, "failed": 0}

        try:
            if schedule is None:
                result = supabase_client.admin.table("posting_schedules").select(
                    "*"
                ).eq("user_id", user_id).eq("is_active", True).eq("auto_topic", True).limit(1).execute()
                schedule = result.data[0] if result.data else None

            if not schedule:
                stats["skipped"] += 1
                return stats

            has_access = await posting_worker._check_user_access(user_id)
            if not has_access:
                logger.warning(
                    f"User {user_id} subscription expired, skipping auto-generation"
                )
                stats["skipped"] += 1
                return stats

            user_settings = await load_user_automation_settings(user_id)
            target_variants = build_target_variants(user_settings)
            desired_slots = self._calculate_all_slots(
                schedule=schedule,
                max_posts_per_day=user_settings.get("max_posts_per_day", 1),
                days_ahead=_DAYS_AHEAD_MAX,
            )

            if not desired_slots:
                stats["skipped"] += 1
                return stats

            now_iso = utc_now().isoformat()
            existing_result = supabase_client.admin.table("posts").select(
                "scheduled_at,target,organization_id"
            ).eq("user_id", user_id).in_(
                "status", ["scheduled", "pending_review", "draft"]
            ).gte("scheduled_at", now_iso).execute()

            existing_assignments: List[Dict[str, Any]] = []
            for row in (existing_result.data or []):
                dt = parse_datetime_utc(row.get("scheduled_at"))
                if not dt:
                    continue

                existing_assignments.append(
                    {
                        "scheduled_at": dt,
                        "target": str(row.get("target") or "person").strip().lower() or "person",
                        "organization_id": str(row.get("organization_id") or "").strip() or None,
                    }
                )

            slot_plans: List[Dict[str, Any]] = []
            for slot in desired_slots:
                missing_variants = []
                for variant in target_variants:
                    already_covered = any(
                        abs((slot - assignment["scheduled_at"]).total_seconds()) < 1800
                        and assignment["target"] == variant["target"]
                        and assignment["organization_id"] == variant.get("organization_id")
                        for assignment in existing_assignments
                    )
                    if not already_covered:
                        missing_variants.append(variant)

                if missing_variants:
                    slot_plans.append(
                        {
                            "slot_time": slot,
                            "variants": missing_variants,
                        }
                    )

            if not slot_plans:
                logger.info(f"User {user_id}: all desired slots are already covered")
                stats["skipped"] += 1
                return stats

            categories = schedule.get("categories") or []
            for index, slot_plan in enumerate(slot_plans):
                slot_time = slot_plan["slot_time"]
                variants = slot_plan["variants"]

                try:
                    category = (
                        categories[index % len(categories)]
                        if categories
                        else "Industry insights"
                    )
                    topic = build_topic_from_category(category, user_settings)
                    generated = await self._generate_high_quality_content(
                        topic=topic,
                        user_settings=user_settings,
                        category=category,
                    )
                    final_caption = compose_linkedin_caption(generated)

                    for variant in variants:
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
                            "content_type": generated.content_type.value,
                            "target": variant["target"],
                            "organization_id": variant.get("organization_id"),
                        }

                        supabase_client.admin.table("posts").insert(post_data).execute()
                        existing_assignments.append(
                            {
                                "scheduled_at": slot_time,
                                "target": variant["target"],
                                "organization_id": variant.get("organization_id"),
                            }
                        )

                        logger.info(
                            f"Auto-generated scheduled post for user {user_id} "
                            f"at {slot_time.isoformat()} target={variant['target']}"
                        )
                        stats["generated"] += 1

                except Exception as slot_err:
                    logger.error(
                        f"Error generating post for user {user_id} "
                        f"slot {slot_time.isoformat()}: {slot_err}"
                    )
                    stats["failed"] += 1

            return stats
        except Exception as e:
            logger.error(f"Auto-generator failed for user {user_id}: {e}")
            stats["failed"] += 1
            return stats

    async def _generate_high_quality_content(
        self,
        topic: str,
        user_settings: Dict[str, Any],
        category: str
    ):
        """Generate content and retry once if the output is too generic."""
        instructions = build_generation_instructions(user_settings, category)
        generated = await content_service.generate_content(
            topic=topic,
            goal=user_settings.get("default_goal", "Authority"),
            audience=user_settings.get("default_audience", "General Professionals"),
            style=user_settings.get("default_style", "Carousel slides"),
            tone=user_settings.get("default_tone", "professional"),
            instructions=instructions,
        )

        quality_score = int(getattr(generated, "quality_score", 0) or 0)
        caption_length = len(str(getattr(generated, "caption", "") or "").strip())
        if quality_score >= 78 and caption_length >= 120:
            return generated

        retry = await content_service.generate_content(
            topic=topic,
            goal=user_settings.get("default_goal", "Authority"),
            audience=user_settings.get("default_audience", "General Professionals"),
            style=user_settings.get("default_style", "Carousel slides"),
            tone=user_settings.get("default_tone", "professional"),
            instructions=(
                instructions
                + " Raise the specificity, practical value, and clarity. "
                + "Use a sharper point of view and a more concrete example."
            ),
        )

        retry_quality = int(getattr(retry, "quality_score", 0) or 0)
        retry_caption_length = len(str(getattr(retry, "caption", "") or "").strip())
        if retry_quality > quality_score or retry_caption_length > caption_length:
            return retry

        return generated

    def _calculate_all_slots(
        self,
        schedule: Dict[str, Any],
        max_posts_per_day: int,
        days_ahead: int = _DAYS_AHEAD_MAX
    ) -> List[datetime]:
        """Calculate future UTC slots from the exact saved comma-separated times."""
        if not schedule.get("is_active"):
            return []

        try:
            user_tz = pytz.timezone(schedule.get("timezone", "Asia/Kolkata"))
        except Exception:
            user_tz = pytz.timezone("Asia/Kolkata")

        raw_time_value = schedule.get("time_of_day", "09:00")
        parsed_times: List[time] = []
        if isinstance(raw_time_value, str):
            for raw_entry in raw_time_value.split(","):
                candidate = raw_entry.strip()
                if not candidate:
                    continue

                parts = candidate.split(":")
                try:
                    parsed_time = time(
                        hour=int(parts[0]),
                        minute=int(parts[1]) if len(parts) > 1 else 0,
                    )
                except (ValueError, IndexError):
                    continue

                if all(existing != parsed_time for existing in parsed_times):
                    parsed_times.append(parsed_time)

        if not parsed_times:
            parsed_times = [time(9, 0)]

        parsed_times.sort()
        parsed_times = parsed_times[:max_posts_per_day]

        day_map = {
            "MON": 0,
            "TUE": 1,
            "WED": 2,
            "THU": 3,
            "FRI": 4,
            "SAT": 5,
            "SUN": 6,
        }
        schedule_days = [
            str(day).strip().upper()
            for day in (schedule.get("days_of_week", []) or [])
            if str(day).strip()
        ]
        scheduled_weekdays = {day_map[day] for day in schedule_days if day in day_map}
        if not scheduled_weekdays:
            return []

        now_utc = utc_now()
        now_local = now_utc.astimezone(user_tz)
        slots: List[datetime] = []

        for day_offset in range(days_ahead):
            candidate_date = now_local.date() + timedelta(days=day_offset)
            if candidate_date.weekday() not in scheduled_weekdays:
                continue

            for slot_time in parsed_times:
                slot_naive = datetime.combine(candidate_date, slot_time)
                try:
                    slot_local = user_tz.localize(slot_naive, is_dst=None)
                except Exception:
                    slot_local = user_tz.localize(slot_naive, is_dst=False)

                slot_utc = slot_local.astimezone(pytz.UTC)
                if slot_utc > now_utc + timedelta(minutes=5):
                    slots.append(slot_utc)

        slots.sort()
        return slots


auto_generator_worker = AutoGeneratorWorker()
