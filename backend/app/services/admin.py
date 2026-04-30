"""
Admin Service - Business logic for admin operations.

This service handles:
- User management (block, unblock, suspend)
- Subscription management (extend trial, cancel, activate)
- Usage tracking and limits
- Admin analytics
- Audit logging

Security:
- All operations require admin role
- All actions logged in audit_logs
- RLS enforced at database level
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, time, timedelta
import pytz
from ..core.config import logger
from ..core.datetime_utils import utc_now, parse_datetime_utc
from ..services.database import supabase_client, normalize_full_name


class AdminService:
    """
    Service for admin operations.
    
    All methods require admin authentication and log actions.
    """
    
    async def verify_admin(self, user_id: str) -> bool:
        """
        Verify if user is an admin.
        
        Args:
            user_id: User ID to check
            
        Returns:
            True if admin, False otherwise
        """
        try:
            result = supabase_client.admin.table("roles").select("role").eq(
                "user_id", user_id
            ).single().execute()
            
            return result.data and result.data.get("role") == "admin"
            
        except Exception as e:
            logger.error(f"Admin verification failed: {e}")
            return False
    
    async def log_admin_action(
        self,
        admin_id: str,
        action: str,
        target_user_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ):
        """
        Log admin action to audit log.
        
        Args:
            admin_id: Admin user ID
            action: Action performed
            target_user_id: Target user ID (if applicable)
            details: Additional details
            ip_address: Admin's IP address
        """
        try:
            supabase_client.admin.table("admin_audit_logs").insert({
                "admin_id": admin_id,
                "action": action,
                "target_user_id": target_user_id,
                "details": details or {},
                "ip_address": ip_address
            }).execute()
            
            logger.info(
                f"Admin action logged: {action} by {admin_id} "
                f"on user {target_user_id}"
            )
            
        except Exception as e:
            logger.error(f"Failed to log admin action: {e}")

    @staticmethod
    def _resolve_subscription_status(sub: Dict[str, Any]) -> str:
        """
        Resolve effective subscription status when restoring a user.
        """
        renewal_date = parse_datetime_utc(sub.get("renewal_date"))
        trial_end = parse_datetime_utc(sub.get("trial_end"))
        if trial_end and trial_end > utc_now():
            return "trial"
        if renewal_date and renewal_date > utc_now():
            return "active"
        return "expired"

    @staticmethod
    def _normalize_user_row(user_row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize user-facing profile fields for admin tables.
        """
        row = dict(user_row)
        row["full_name"] = normalize_full_name(
            row.get("full_name"),
            row.get("email")
        )
        return row

    @staticmethod
    def _build_subscription_date_patch(sub: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ensure subscription records always include start and renewal dates.
        """
        patch: Dict[str, Any] = {}
        now = utc_now()
        created_at = parse_datetime_utc(sub.get("created_at")) or now

        subscription_start = parse_datetime_utc(sub.get("subscription_start"))
        if not subscription_start:
            patch["subscription_start"] = created_at.isoformat()
            subscription_start = created_at

        renewal_date = parse_datetime_utc(sub.get("renewal_date"))
        if not renewal_date:
            patch["renewal_date"] = (subscription_start + timedelta(days=30)).isoformat()

        return patch

    @staticmethod
    def _count_rows(result: Any) -> int:
        """Return Supabase exact count when present, otherwise data length."""
        count = getattr(result, "count", None)
        if count is not None:
            return int(count)
        return len(result.data or [])

    @staticmethod
    def _local_day_bounds(day, timezone_name: str) -> tuple[str, str]:
        """Return UTC ISO bounds for a local calendar day."""
        try:
            user_tz = pytz.timezone(timezone_name or "Asia/Kolkata")
        except Exception:
            user_tz = pytz.timezone("Asia/Kolkata")

        start_local = user_tz.localize(datetime.combine(day, time.min), is_dst=False)
        end_local = start_local + timedelta(days=1)
        return (
            start_local.astimezone(pytz.UTC).isoformat(),
            end_local.astimezone(pytz.UTC).isoformat(),
        )

    async def get_user_automation_diagnostics(self, user_id: str) -> Dict[str, Any]:
        """Build an admin-facing automation health snapshot for one user."""
        try:
            schedule_result = supabase_client.admin.table("posting_schedules").select(
                "*"
            ).eq("user_id", user_id).limit(1).execute()
            schedule = schedule_result.data[0] if schedule_result.data else None

            settings_result = supabase_client.admin.table("settings").select(
                "auto_post,max_posts_per_day,publish_target,organization_id"
            ).eq("user_id", user_id).limit(1).execute()
            settings = settings_result.data[0] if settings_result.data else {}

            token_result = supabase_client.admin.table("linkedin_tokens").select(
                "expires_at"
            ).eq("user_id", user_id).order("expires_at", desc=True).limit(1).execute()
            token = token_result.data[0] if token_result.data else None
            token_expires_at = token.get("expires_at") if token else None
            linkedin_connected = bool(
                token_expires_at and parse_datetime_utc(token_expires_at)
                and parse_datetime_utc(token_expires_at) > utc_now()
            )

            timezone_name = (
                schedule.get("timezone")
                if schedule
                else "Asia/Kolkata"
            ) or "Asia/Kolkata"
            try:
                user_tz = pytz.timezone(timezone_name)
            except Exception:
                user_tz = pytz.timezone("Asia/Kolkata")
                timezone_name = "Asia/Kolkata"

            today = utc_now().astimezone(user_tz).date()
            tomorrow = today + timedelta(days=1)
            today_start, today_end = self._local_day_bounds(today, timezone_name)
            tomorrow_start, tomorrow_end = self._local_day_bounds(tomorrow, timezone_name)

            generated_today = self._count_rows(
                supabase_client.admin.table("posts").select("id", count="exact").eq(
                    "user_id", user_id
                ).gte("created_at", today_start).lt("created_at", today_end).execute()
            )
            posted_today = self._count_rows(
                supabase_client.admin.table("posts").select("id", count="exact").eq(
                    "user_id", user_id
                ).eq("status", "posted").gte("posted_at", today_start).lt(
                    "posted_at", today_end
                ).execute()
            )
            tomorrow_result = supabase_client.admin.table("posts").select(
                "id,status,scheduled_at,topic"
            ).eq("user_id", user_id).gte("scheduled_at", tomorrow_start).lt(
                "scheduled_at", tomorrow_end
            ).order("scheduled_at").execute()
            tomorrow_posts = tomorrow_result.data or []

            queue_statuses = {"draft", "pending_review", "scheduled", "running"}
            tomorrow_by_status: Dict[str, int] = {}
            for post in tomorrow_posts:
                status = str(post.get("status") or "unknown")
                tomorrow_by_status[status] = tomorrow_by_status.get(status, 0) + 1

            queue_today = self._count_rows(
                supabase_client.admin.table("posts").select("id", count="exact").eq(
                    "user_id", user_id
                ).in_("status", list(queue_statuses)).execute()
            )

            next_post_result = supabase_client.admin.table("posts").select(
                "id,status,scheduled_at,topic"
            ).eq("user_id", user_id).in_("status", ["scheduled", "pending_review"]).gte(
                "scheduled_at", utc_now().isoformat()
            ).order("scheduled_at").limit(1).execute()
            next_post = next_post_result.data[0] if next_post_result.data else None

            reasons: List[str] = []
            if not linkedin_connected:
                reasons.append("LinkedIn is not connected or token expired.")
            if not bool(settings.get("auto_post")):
                reasons.append("Auto-post is off in settings.")
            if not schedule:
                reasons.append("No posting schedule is saved.")
            elif not schedule.get("is_active"):
                reasons.append("Posting schedule is inactive.")
            elif not schedule.get("auto_topic"):
                reasons.append("Auto-topic generation is off.")
            if schedule and not (schedule.get("days_of_week") or []):
                reasons.append("No schedule days are selected.")

            return {
                "linkedin_connected": linkedin_connected,
                "linkedin_token_expires_at": token_expires_at,
                "auto_post": bool(settings.get("auto_post")),
                "max_posts_per_day": int(settings.get("max_posts_per_day") or 1),
                "publish_target": settings.get("publish_target") or "person",
                "organization_id": settings.get("organization_id"),
                "schedule_active": bool(schedule and schedule.get("is_active")),
                "auto_topic": bool(schedule and schedule.get("auto_topic")),
                "timezone": timezone_name,
                "days_of_week": (schedule or {}).get("days_of_week") or [],
                "time_of_day": (schedule or {}).get("time_of_day"),
                "categories": (schedule or {}).get("categories") or [],
                "generated_today": generated_today,
                "posted_today": posted_today,
                "queue_total": queue_today,
                "tomorrow_generated": len(tomorrow_posts),
                "tomorrow_in_queue": len([
                    post for post in tomorrow_posts
                    if str(post.get("status") or "") in queue_statuses
                ]),
                "tomorrow_by_status": tomorrow_by_status,
                "tomorrow_posts": tomorrow_posts[:5],
                "next_post": next_post,
                "health": "ok" if not reasons else "needs_attention",
                "reasons": reasons,
            }
        except Exception as e:
            logger.error(f"Failed to build automation diagnostics for {user_id}: {e}")
            return {
                "health": "error",
                "reasons": ["Could not load automation diagnostics."],
            }
    
    # =========================================================================
    # USER MANAGEMENT
    # =========================================================================
    
    async def get_all_users(
        self,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        status_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get all users with pagination and filtering.
        
        Args:
            page: Page number
            page_size: Items per page
            search: Search term (email/name)
            status_filter: Filter by subscription status
            
        Returns:
            Users data with pagination info
        """
        try:
            # Build query
            query = supabase_client.admin.from_("admin_users_view").select("*")
            
            # Apply search filter
            if search:
                query = query.or_(
                    f"email.ilike.%{search}%,full_name.ilike.%{search}%"
                )
            
            # Apply status filter
            if status_filter:
                query = query.eq("subscription_status", status_filter)
            
            # Get total count
            count_result = query.execute()
            total = len(count_result.data) if count_result.data else 0
            
            # Apply pagination
            offset = (page - 1) * page_size
            query = query.order("signup_date", desc=True).range(
                offset, offset + page_size - 1
            )
            
            result = query.execute()
            users = [
                self._normalize_user_row(user)
                for user in (result.data or [])
            ]
            
            return {
                "users": users,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size
            }
            
        except Exception as e:
            logger.error(f"Failed to get users: {e}")
            raise Exception("Failed to retrieve users")
    
    async def get_user_details(self, user_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific user.
        
        Args:
            user_id: User ID
            
        Returns:
            User details including subscription, usage, and activity
        """
        try:
            result = supabase_client.admin.from_("admin_users_view").select(
                "*"
            ).eq("id", user_id).single().execute()
            
            if not result.data:
                raise Exception("User not found")

            user = self._normalize_user_row(result.data)
            user["automation"] = await self.get_user_automation_diagnostics(user_id)
            return user
            
        except Exception as e:
            logger.error(f"Failed to get user details: {e}")
            raise
    
    async def block_user(
        self,
        admin_id: str,
        user_id: str,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Block a user from accessing the platform.
        
        Args:
            admin_id: Admin performing the action
            user_id: User to block
            reason: Reason for blocking
            ip_address: Admin's IP
            
        Returns:
            Updated subscription data
        """
        try:
            sub_result = supabase_client.admin.table("subscriptions").select(
                "*"
            ).eq("user_id", user_id).single().execute()

            if not sub_result.data:
                raise Exception("Subscription not found")

            update_payload = {"status": "blocked"}
            update_payload.update(self._build_subscription_date_patch(sub_result.data))

            # Update subscription status to blocked
            result = supabase_client.admin.table("subscriptions").update({
                **update_payload
            }).eq("user_id", user_id).execute()
            
            # Log action
            await self.log_admin_action(
                admin_id=admin_id,
                action="user_blocked",
                target_user_id=user_id,
                details={"reason": reason},
                ip_address=ip_address
            )
            
            logger.info(f"User {user_id} blocked by admin {admin_id}")
            
            return result.data[0] if result.data else {}
            
        except Exception as e:
            logger.error(f"Failed to block user: {e}")
            raise Exception("Failed to block user")
    
    async def unblock_user(
        self,
        admin_id: str,
        user_id: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Unblock a user.
        
        Args:
            admin_id: Admin performing the action
            user_id: User to unblock
            ip_address: Admin's IP
            
        Returns:
            Updated subscription data
        """
        try:
            # Get current subscription
            sub_result = supabase_client.admin.table("subscriptions").select(
                "*"
            ).eq("user_id", user_id).single().execute()
            
            if not sub_result.data:
                raise Exception("Subscription not found")
            
            # Determine new status
            sub = sub_result.data
            new_status = self._resolve_subscription_status(sub)
            
            # Update subscription status
            result = supabase_client.admin.table("subscriptions").update({
                "status": new_status
            }).eq("user_id", user_id).execute()
            
            # Log action
            await self.log_admin_action(
                admin_id=admin_id,
                action="user_unblocked",
                target_user_id=user_id,
                details={"new_status": new_status},
                ip_address=ip_address
            )
            
            logger.info(f"User {user_id} unblocked by admin {admin_id}")
            
            return result.data[0] if result.data else {}
            
        except Exception as e:
            logger.error(f"Failed to unblock user: {e}")
            raise Exception("Failed to unblock user")

    async def suspend_user(
        self,
        admin_id: str,
        user_id: str,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Suspend user access. Internally maps to blocked status.
        """
        try:
            sub_result = supabase_client.admin.table("subscriptions").select(
                "*"
            ).eq("user_id", user_id).single().execute()

            if not sub_result.data:
                raise Exception("Subscription not found")

            update_payload = {"status": "blocked"}
            update_payload.update(self._build_subscription_date_patch(sub_result.data))

            result = supabase_client.admin.table("subscriptions").update(
                update_payload
            ).eq("user_id", user_id).execute()

            await self.log_admin_action(
                admin_id=admin_id,
                action="user_suspended",
                target_user_id=user_id,
                details={"reason": reason},
                ip_address=ip_address
            )

            logger.info(f"User {user_id} suspended by admin {admin_id}")
            return result.data[0] if result.data else {}

        except Exception as e:
            logger.error(f"Failed to suspend user: {e}")
            raise Exception("Failed to suspend user")

    async def resume_user(
        self,
        admin_id: str,
        user_id: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Resume suspended/blocked user access.
        """
        try:
            sub_result = supabase_client.admin.table("subscriptions").select(
                "*"
            ).eq("user_id", user_id).single().execute()

            if not sub_result.data:
                raise Exception("Subscription not found")

            new_status = self._resolve_subscription_status(sub_result.data)
            result = supabase_client.admin.table("subscriptions").update({
                "status": new_status
            }).eq("user_id", user_id).execute()

            await self.log_admin_action(
                admin_id=admin_id,
                action="user_resumed",
                target_user_id=user_id,
                details={"new_status": new_status},
                ip_address=ip_address
            )

            logger.info(f"User {user_id} resumed by admin {admin_id}")
            return result.data[0] if result.data else {}

        except Exception as e:
            logger.error(f"Failed to resume user: {e}")
            raise Exception("Failed to resume user")
    
    # =========================================================================
    # SUBSCRIPTION MANAGEMENT
    # =========================================================================
    
    async def get_all_subscriptions(
        self,
        status_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all subscriptions with optional status filter.
        
        Args:
            status_filter: Filter by status (trial, active, expired, etc.)
            
        Returns:
            List of subscriptions
        """
        try:
            query = supabase_client.admin.table("subscriptions").select(
                "*, users(email, full_name)"
            )
            
            if status_filter:
                query = query.eq("status", status_filter)
            
            result = query.order("created_at", desc=True).execute()
            subscriptions = result.data or []

            normalized: List[Dict[str, Any]] = []
            for sub in subscriptions:
                item = dict(sub)
                user_data = item.get("users")
                if isinstance(user_data, dict):
                    item["users"] = self._normalize_user_row(user_data)
                normalized.append(item)

            return normalized
            
        except Exception as e:
            logger.error(f"Failed to get subscriptions: {e}")
            raise Exception("Failed to retrieve subscriptions")
    
    async def extend_trial(
        self,
        admin_id: str,
        user_id: str,
        days: int,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extend user's trial period.
        
        Args:
            admin_id: Admin performing the action
            user_id: User whose trial to extend
            days: Number of days to extend
            ip_address: Admin's IP
            
        Returns:
            Updated subscription data
        """
        try:
            # Get current subscription
            sub_result = supabase_client.admin.table("subscriptions").select(
                "*"
            ).eq("user_id", user_id).single().execute()
            
            if not sub_result.data:
                raise Exception("Subscription not found")
            
            sub = sub_result.data
            
            # Calculate new trial end date
            current_trial_end = parse_datetime_utc(
                sub.get("trial_end")
            ) or utc_now()
            
            new_trial_end = max(current_trial_end, utc_now()) + timedelta(days=days)
            
            # Update subscription
            update_payload: Dict[str, Any] = {
                "trial_end": new_trial_end.isoformat(),
                "status": "trial"
            }
            if not sub.get("trial_start"):
                update_payload["trial_start"] = utc_now().isoformat()

            result = supabase_client.admin.table("subscriptions").update(
                update_payload
            ).eq("user_id", user_id).execute()
            
            # Log action
            await self.log_admin_action(
                admin_id=admin_id,
                action="trial_extended",
                target_user_id=user_id,
                details={"days": days, "new_trial_end": new_trial_end.isoformat()},
                ip_address=ip_address
            )
            
            logger.info(
                f"Trial extended for user {user_id} by {days} days "
                f"(admin: {admin_id})"
            )
            
            return result.data[0] if result.data else {}
            
        except Exception as e:
            logger.error(f"Failed to extend trial: {e}")
            raise Exception("Failed to extend trial")
    
    async def activate_subscription(
        self,
        admin_id: str,
        user_id: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Manually activate a user's subscription.
        
        Args:
            admin_id: Admin performing the action
            user_id: User to activate
            ip_address: Admin's IP
            
        Returns:
            Updated subscription data
        """
        try:
            # Update subscription to active
            result = supabase_client.admin.table("subscriptions").update({
                "status": "active",
                "subscription_start": utc_now().isoformat(),
                "renewal_date": (utc_now() + timedelta(days=30)).isoformat()
            }).eq("user_id", user_id).execute()
            
            # Log action
            await self.log_admin_action(
                admin_id=admin_id,
                action="subscription_activated",
                target_user_id=user_id,
                details={},
                ip_address=ip_address
            )
            
            logger.info(
                f"Subscription activated for user {user_id} (admin: {admin_id})"
            )
            
            return result.data[0] if result.data else {}
            
        except Exception as e:
            logger.error(f"Failed to activate subscription: {e}")
            raise Exception("Failed to activate subscription")
    
    async def cancel_subscription(
        self,
        admin_id: str,
        user_id: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Cancel a user's subscription.
        
        Args:
            admin_id: Admin performing the action
            user_id: User whose subscription to cancel
            ip_address: Admin's IP
            
        Returns:
            Updated subscription data
        """
        try:
            sub_result = supabase_client.admin.table("subscriptions").select(
                "*"
            ).eq("user_id", user_id).single().execute()

            if not sub_result.data:
                raise Exception("Subscription not found")

            update_payload = {"status": "cancelled"}
            update_payload.update(self._build_subscription_date_patch(sub_result.data))

            # Update subscription to cancelled
            result = supabase_client.admin.table("subscriptions").update(
                update_payload
            ).eq("user_id", user_id).execute()
            
            # Log action
            await self.log_admin_action(
                admin_id=admin_id,
                action="subscription_cancelled",
                target_user_id=user_id,
                details={},
                ip_address=ip_address
            )
            
            logger.info(
                f"Subscription cancelled for user {user_id} (admin: {admin_id})"
            )
            
            return result.data[0] if result.data else {}
            
        except Exception as e:
            logger.error(f"Failed to cancel subscription: {e}")
            raise Exception("Failed to cancel subscription")

    async def hold_subscription(
        self,
        admin_id: str,
        user_id: str,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Place a subscription on hold.

        Internally maps to `cancelled` status until billing integration is added.
        """
        try:
            sub_result = supabase_client.admin.table("subscriptions").select(
                "*"
            ).eq("user_id", user_id).single().execute()

            if not sub_result.data:
                raise Exception("Subscription not found")

            update_payload = {"status": "cancelled"}
            update_payload.update(self._build_subscription_date_patch(sub_result.data))

            result = supabase_client.admin.table("subscriptions").update(
                update_payload
            ).eq("user_id", user_id).execute()

            await self.log_admin_action(
                admin_id=admin_id,
                action="subscription_on_hold",
                target_user_id=user_id,
                details={"reason": reason},
                ip_address=ip_address
            )

            logger.info(
                f"Subscription put on hold for user {user_id} (admin: {admin_id})"
            )

            return result.data[0] if result.data else {}

        except Exception as e:
            logger.error(f"Failed to hold subscription: {e}")
            raise Exception("Failed to hold subscription")

    async def resume_subscription(
        self,
        admin_id: str,
        user_id: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Resume held or cancelled subscription.
        """
        try:
            sub_result = supabase_client.admin.table("subscriptions").select(
                "*"
            ).eq("user_id", user_id).single().execute()

            if not sub_result.data:
                raise Exception("Subscription not found")

            sub = sub_result.data
            new_status = self._resolve_subscription_status(sub)
            update_data: Dict[str, Any] = {"status": new_status}

            if new_status == "expired":
                # Resume as active paid subscription when no valid trial exists.
                new_status = "active"
                update_data["status"] = "active"
                if not sub.get("subscription_start"):
                    update_data["subscription_start"] = utc_now().isoformat()
                update_data["renewal_date"] = (utc_now() + timedelta(days=30)).isoformat()

            result = supabase_client.admin.table("subscriptions").update(
                update_data
            ).eq("user_id", user_id).execute()

            await self.log_admin_action(
                admin_id=admin_id,
                action="subscription_resumed",
                target_user_id=user_id,
                details={"new_status": update_data["status"]},
                ip_address=ip_address
            )

            logger.info(
                f"Subscription resumed for user {user_id} with status {update_data['status']} "
                f"(admin: {admin_id})"
            )

            return result.data[0] if result.data else {}

        except Exception as e:
            logger.error(f"Failed to resume subscription: {e}")
            raise Exception("Failed to resume subscription")

    # =========================================================================
    # BILLING PLAN & COUPONS
    # =========================================================================

    async def get_billing_plan(self) -> Dict[str, Any]:
        """Return the active editable billing plan."""
        from ..services.billing import billing_service

        plans = billing_service.get_active_plans()
        plan_names = {str(item.get("plan_name") or "").strip().lower() for item in plans}
        if "pro" in plan_names:
            return billing_service.get_plan_by_name("pro") or billing_service.get_active_plan()
        return billing_service.get_active_plan()

    async def update_billing_plan(
        self,
        admin_id: str,
        plan_data: Dict[str, Any],
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create or update the active billing plan."""
        try:
            from ..services.billing import billing_service

            requested_plan_name = str(plan_data["plan_name"]).strip().lower()
            active_plan_names = {
                str(item.get("plan_name") or "").strip().lower()
                for item in billing_service.get_active_plans()
            }
            if requested_plan_name == "monthly" and "starter" in active_plan_names and "pro" in active_plan_names:
                requested_plan_name = "pro"

            payload = {
                "plan_name": requested_plan_name,
                "display_name": plan_data["display_name"],
                "amount_paise": plan_data["amount_paise"],
                "currency": plan_data["currency"].upper(),
                "billing_period_days": plan_data["billing_period_days"],
                "checkout_description": plan_data.get("checkout_description"),
                "is_active": True,
            }
            result = supabase_client.admin.table("billing_plan_settings").upsert(
                payload,
                on_conflict="plan_name",
            ).execute()

            await self.log_admin_action(
                admin_id=admin_id,
                action="billing_plan_updated",
                details=payload,
                ip_address=ip_address,
            )

            return result.data[0] if result.data else payload
        except Exception as e:
            logger.error(f"Failed to update billing plan: {e}")
            raise Exception("Failed to update billing plan")

    async def get_billing_coupons(self) -> List[Dict[str, Any]]:
        """List billing coupons for admin management."""
        try:
            result = supabase_client.admin.table("billing_coupons").select(
                "*"
            ).order("created_at", desc=True).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get billing coupons: {e}")
            raise Exception("Failed to retrieve billing coupons")

    async def create_billing_coupon(
        self,
        admin_id: str,
        coupon_data: Dict[str, Any],
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a billing coupon."""
        try:
            payload = dict(coupon_data)
            payload["code"] = payload["code"].upper()
            result = supabase_client.admin.table("billing_coupons").insert(
                payload
            ).execute()

            await self.log_admin_action(
                admin_id=admin_id,
                action="billing_coupon_created",
                details={"code": payload["code"]},
                ip_address=ip_address,
            )

            return result.data[0] if result.data else payload
        except Exception as e:
            logger.error(f"Failed to create billing coupon: {e}")
            raise Exception("Failed to create billing coupon")

    async def update_billing_coupon(
        self,
        admin_id: str,
        coupon_id: str,
        coupon_data: Dict[str, Any],
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update a billing coupon."""
        try:
            payload = {
                key: value
                for key, value in coupon_data.items()
                if value is not None
            }
            if not payload:
                result = supabase_client.admin.table("billing_coupons").select(
                    "*"
                ).eq("id", coupon_id).single().execute()
                return result.data or {}

            result = supabase_client.admin.table("billing_coupons").update(
                payload
            ).eq("id", coupon_id).execute()

            await self.log_admin_action(
                admin_id=admin_id,
                action="billing_coupon_updated",
                details={"coupon_id": coupon_id, **payload},
                ip_address=ip_address,
            )

            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to update billing coupon: {e}")
            raise Exception("Failed to update billing coupon")
    
    # =========================================================================
    # USAGE TRACKING
    # =========================================================================
    
    async def get_usage_metrics(
        self,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get usage metrics for all users or specific user.
        
        Args:
            user_id: Optional user ID to filter
            
        Returns:
            Usage metrics data
        """
        try:
            query = supabase_client.admin.table("usage_metrics").select(
                "*, users(email, full_name)"
            )
            
            if user_id:
                query = query.eq("user_id", user_id)
            
            result = query.order("last_activity", desc=True).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Failed to get usage metrics: {e}")
            raise Exception("Failed to retrieve usage metrics")
    
    async def reset_usage(
        self,
        admin_id: str,
        user_id: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Reset usage metrics for a user.
        
        Args:
            admin_id: Admin performing the action
            user_id: User whose usage to reset
            ip_address: Admin's IP
            
        Returns:
            Updated usage metrics
        """
        try:
            # Reset all usage counters
            result = supabase_client.admin.table("usage_metrics").update({
                "posts_generated": 0,
                "images_generated": 0,
                "linkedin_posts": 0,
                "api_calls": 0
            }).eq("user_id", user_id).execute()
            
            # Log action
            await self.log_admin_action(
                admin_id=admin_id,
                action="usage_reset",
                target_user_id=user_id,
                details={},
                ip_address=ip_address
            )
            
            logger.info(f"Usage reset for user {user_id} (admin: {admin_id})")
            
            return result.data[0] if result.data else {}
            
        except Exception as e:
            logger.error(f"Failed to reset usage: {e}")
            raise Exception("Failed to reset usage")
    
    # =========================================================================
    # ANALYTICS & DASHBOARD
    # =========================================================================
    
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """
        Get admin dashboard statistics.
        
        Returns:
            Dashboard stats (total users, MRR, conversions, etc.)
        """
        try:
            now = utc_now()
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

            users_result = supabase_client.admin.table("users").select(
                "id,created_at", count="exact"
            ).execute()
            total_users = self._count_rows(users_result)
            new_users_this_month = len([
                user for user in (users_result.data or [])
                if parse_datetime_utc(user.get("created_at"))
                and parse_datetime_utc(user.get("created_at")) >= month_start
            ])

            subs_result = supabase_client.admin.table("subscriptions").select(
                "status,price,trial_end,subscription_start,renewal_date"
            ).execute()
            subscriptions = subs_result.data or []

            active_subs = [
                sub for sub in subscriptions
                if str(sub.get("status") or "").lower() == "active"
            ]
            trial_subs = [
                sub for sub in subscriptions
                if str(sub.get("status") or "").lower() == "trial"
                and (
                    not parse_datetime_utc(sub.get("trial_end"))
                    or parse_datetime_utc(sub.get("trial_end")) > now
                )
            ]
            expired_trials = [
                sub for sub in subscriptions
                if str(sub.get("status") or "").lower() == "expired"
            ]
            blocked_users = [
                sub for sub in subscriptions
                if str(sub.get("status") or "").lower() == "blocked"
            ]

            mrr = sum(float(sub.get("price") or 0) for sub in active_subs)
            new_subscribers_this_month = len([
                sub for sub in active_subs
                if parse_datetime_utc(sub.get("subscription_start"))
                and parse_datetime_utc(sub.get("subscription_start")) >= month_start
            ])

            return {
                "total_users": total_users,
                "active_subscribers": len(active_subs),
                "trial_users": len(trial_subs),
                "expired_trials": len(expired_trials),
                "blocked_users": len(blocked_users),
                "mrr": mrr,
                "new_users_this_month": new_users_this_month,
                "new_subscribers_this_month": new_subscribers_this_month,
            }
            
        except Exception as e:
            logger.error(f"Failed to get dashboard stats: {e}")
            raise Exception("Failed to retrieve dashboard statistics")
    
    async def get_revenue_analytics(self) -> List[Dict[str, Any]]:
        """
        Get revenue analytics by month.
        
        Returns:
            Monthly revenue data
        """
        try:
            try:
                result = supabase_client.admin.table("billing_payments").select(
                    "status,amount,amount_paise,final_amount_paise,paid_at,verified_at,created_at"
                ).eq("status", "captured").execute()
            except Exception:
                result = supabase_client.admin.table("billing_payments").select(
                    "status,amount,amount_paise,paid_at,verified_at,created_at"
                ).eq("status", "captured").execute()

            monthly: Dict[str, Dict[str, Any]] = {}
            for payment in (result.data or []):
                paid_at = (
                    parse_datetime_utc(payment.get("paid_at"))
                    or parse_datetime_utc(payment.get("verified_at"))
                    or parse_datetime_utc(payment.get("created_at"))
                )
                if not paid_at:
                    continue

                month_start = paid_at.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                key = month_start.date().isoformat()
                amount_paise = payment.get("final_amount_paise")
                if amount_paise is None:
                    amount_paise = payment.get("amount_paise")
                amount = (
                    float(amount_paise or 0) / 100
                    if amount_paise is not None
                    else float(payment.get("amount") or 0)
                )

                bucket = monthly.setdefault(
                    key,
                    {
                        "month": month_start.isoformat(),
                        "new_subscriptions": 0,
                        "revenue": 0.0,
                        "mrr_added": 0.0,
                    },
                )
                bucket["new_subscriptions"] += 1
                bucket["revenue"] += amount
                bucket["mrr_added"] += amount

            return [
                monthly[key]
                for key in sorted(monthly.keys())
            ]
            
        except Exception as e:
            logger.error(f"Failed to get revenue analytics: {e}")
            raise Exception("Failed to retrieve revenue analytics")
    
    async def get_usage_analytics(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get usage analytics for the last N days.
        
        Args:
            days: Number of days to retrieve
            
        Returns:
            Daily usage data
        """
        try:
            since = utc_now() - timedelta(days=days)
            posts_result = supabase_client.admin.table("posts").select(
                "user_id,status,created_at,posted_at"
            ).gte("created_at", since.isoformat()).execute()

            daily: Dict[str, Dict[str, Any]] = {}
            active_users_by_day: Dict[str, set] = {}
            for post in (posts_result.data or []):
                created_at = parse_datetime_utc(post.get("created_at"))
                if not created_at:
                    continue
                key = created_at.date().isoformat()
                bucket = daily.setdefault(
                    key,
                    {
                        "date": created_at.replace(hour=0, minute=0, second=0, microsecond=0).isoformat(),
                        "active_users": 0,
                        "total_posts": 0,
                        "total_images": 0,
                        "total_linkedin_posts": 0,
                        "total_api_calls": 0,
                    },
                )
                bucket["total_posts"] += 1
                active_users_by_day.setdefault(key, set()).add(post.get("user_id"))
                if post.get("status") == "posted":
                    bucket["total_linkedin_posts"] += 1

            for key, users in active_users_by_day.items():
                daily[key]["active_users"] = len({uid for uid in users if uid})

            return [
                daily[key]
                for key in sorted(daily.keys(), reverse=True)
            ][:days]
            
        except Exception as e:
            logger.error(f"Failed to get usage analytics: {e}")
            raise Exception("Failed to retrieve usage analytics")
    
    # =========================================================================
    # AUDIT LOGS
    # =========================================================================
    
    async def get_audit_logs(
        self,
        page: int = 1,
        page_size: int = 50,
        admin_id: Optional[str] = None,
        action_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get admin audit logs with pagination and filtering.
        
        Args:
            page: Page number
            page_size: Items per page
            admin_id: Filter by admin
            action_filter: Filter by action type
            
        Returns:
            Audit logs with pagination info
        """
        try:
            query = supabase_client.admin.table("admin_audit_logs").select(
                "*, admin:admin_id(email, full_name), target:target_user_id(email, full_name)"
            )
            
            if admin_id:
                query = query.eq("admin_id", admin_id)
            
            if action_filter:
                query = query.eq("action", action_filter)
            
            # Get total count
            count_result = query.execute()
            total = len(count_result.data) if count_result.data else 0
            
            # Apply pagination
            offset = (page - 1) * page_size
            query = query.order("created_at", desc=True).range(
                offset, offset + page_size - 1
            )
            
            result = query.execute()
            
            return {
                "logs": result.data or [],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size
            }
            
        except Exception as e:
            logger.error(f"Failed to get audit logs: {e}")
            raise Exception("Failed to retrieve audit logs")


# =============================================================================
# SERVICE INSTANCE
# =============================================================================
admin_service = AdminService()
