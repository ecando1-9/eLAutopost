"""
Razorpay billing service.

Handles:
- Checkout order creation
- Payment signature verification
- Payment capture/fetch
- Subscription activation/renewal
- Webhook processing
"""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import timedelta
from typing import Any, Dict, Optional

import requests
from requests.auth import HTTPBasicAuth

from ..core.config import logger, settings
from ..core.datetime_utils import parse_datetime_utc, utc_now
from ..services.database import get_user_by_id, log_audit_event, supabase_client


class BillingService:
    """Service wrapper for Razorpay billing workflows."""

    base_url = "https://api.razorpay.com/v1"

    def is_configured(self) -> bool:
        """Return True when the server has the required Razorpay keys."""
        return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)

    def get_plan_metadata(self) -> Dict[str, Any]:
        """Expose the single app plan to the frontend."""
        plan = self.get_active_plan()
        return {
            "enabled": self.is_configured(),
            "provider": "razorpay",
            "plan_name": plan["plan_name"],
            "display_name": plan["display_name"],
            "price": round(plan["amount_paise"] / 100, 2),
            "amount_paise": plan["amount_paise"],
            "currency": plan["currency"],
            "billing_period_days": plan["billing_period_days"],
        }

    def get_active_plan(self) -> Dict[str, Any]:
        """Load editable plan settings, falling back to env defaults."""
        fallback = {
            "plan_name": settings.RAZORPAY_PLAN_NAME,
            "display_name": settings.RAZORPAY_PLAN_LABEL,
            "amount_paise": settings.RAZORPAY_PLAN_AMOUNT_PAISE,
            "currency": settings.RAZORPAY_CURRENCY,
            "billing_period_days": 30,
            "checkout_description": settings.RAZORPAY_CHECKOUT_DESCRIPTION,
            "is_active": True,
        }

        try:
            result = supabase_client.admin.table("billing_plan_settings").select(
                "*"
            ).eq("is_active", True).order("updated_at", desc=True).limit(1).execute()
            if result.data:
                return {**fallback, **result.data[0]}
        except Exception as e:
            logger.warning(f"Using env billing plan fallback: {e}")

        return fallback

    def validate_coupon(
        self,
        coupon_code: Optional[str],
        amount_paise: int,
    ) -> Dict[str, Any]:
        """Validate a coupon and calculate the discounted amount."""
        if not coupon_code:
            return {
                "coupon": None,
                "discount_amount_paise": 0,
                "final_amount_paise": amount_paise,
            }

        code = coupon_code.strip().upper()
        result = supabase_client.admin.table("billing_coupons").select(
            "*"
        ).eq("code", code).limit(1).execute()

        if not result.data:
            raise RuntimeError("Coupon code was not found.")

        coupon = result.data[0]
        now = utc_now()
        starts_at = parse_datetime_utc(coupon.get("starts_at"))
        ends_at = parse_datetime_utc(coupon.get("ends_at"))
        max_redemptions = coupon.get("max_redemptions")

        if not coupon.get("is_active"):
            raise RuntimeError("Coupon code is inactive.")
        if starts_at and starts_at > now:
            raise RuntimeError("Coupon code is not active yet.")
        if ends_at and ends_at <= now:
            raise RuntimeError("Coupon code has expired.")
        if max_redemptions and coupon.get("redeemed_count", 0) >= max_redemptions:
            raise RuntimeError("Coupon code has reached its redemption limit.")

        if coupon.get("discount_type") == "percent":
            discount_amount = int(amount_paise * coupon["discount_value"] / 100)
        else:
            discount_amount = int(coupon["discount_value"])

        discount_amount = max(0, min(discount_amount, amount_paise - 100))
        return {
            "coupon": coupon,
            "discount_amount_paise": discount_amount,
            "final_amount_paise": amount_paise - discount_amount,
        }

    def _ensure_configured(self) -> None:
        if not self.is_configured():
            raise RuntimeError(
                "Razorpay is not configured yet. Set RAZORPAY_KEY_ID and "
                "RAZORPAY_KEY_SECRET on the backend."
            )

    def _auth(self) -> HTTPBasicAuth:
        self._ensure_configured()
        return HTTPBasicAuth(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)

    def _request(
        self,
        method: str,
        path: str,
        *,
        payload: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send an authenticated request to Razorpay."""
        self._ensure_configured()
        response = requests.request(
            method=method,
            url=f"{self.base_url}{path}",
            auth=self._auth(),
            json=payload,
            timeout=30,
        )

        if response.status_code >= 400:
            message = response.text
            try:
                error_payload = response.json()
                message = (
                    error_payload.get("error", {}).get("description")
                    or error_payload.get("description")
                    or message
                )
            except ValueError:
                pass

            logger.error(
                f"Razorpay API request failed ({method} {path}): "
                f"{response.status_code} - {message}"
            )
            raise RuntimeError(message or "Razorpay request failed")

        return response.json()

    @staticmethod
    def _build_checkout_signature(order_id: str, payment_id: str) -> str:
        message = f"{order_id}|{payment_id}".encode("utf-8")
        secret = settings.RAZORPAY_KEY_SECRET.encode("utf-8")
        return hmac.new(secret, message, hashlib.sha256).hexdigest()

    def verify_checkout_signature(
        self,
        order_id: str,
        payment_id: str,
        signature: str
    ) -> bool:
        """Verify the checkout success signature returned by Razorpay."""
        expected = self._build_checkout_signature(order_id, payment_id)
        return hmac.compare_digest(expected, signature)

    def verify_webhook_signature(self, raw_body: bytes, signature: str) -> bool:
        """Verify the webhook signature using the configured webhook secret."""
        webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
        if not webhook_secret:
            raise RuntimeError(
                "RAZORPAY_WEBHOOK_SECRET is not configured on the backend."
            )

        expected = hmac.new(
            webhook_secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature or "")

    async def get_or_create_subscription(self, user_id: str) -> Dict[str, Any]:
        """Fetch the user's subscription and self-heal missing rows."""
        result = supabase_client.admin.table("subscriptions").select(
            "*"
        ).eq("user_id", user_id).limit(1).execute()

        if result.data:
            return await self.sync_subscription_status(user_id, result.data[0])

        now = utc_now()
        trial_end = now.replace(microsecond=0) + timedelta(days=30)
        created = supabase_client.admin.table("subscriptions").upsert(
            {
                "user_id": user_id,
                "plan_name": settings.RAZORPAY_PLAN_NAME,
                "price": round(settings.RAZORPAY_PLAN_AMOUNT_PAISE / 100, 2),
                "currency": settings.RAZORPAY_CURRENCY,
                "status": "trial",
                "trial_start": now.isoformat(),
                "trial_end": trial_end.isoformat(),
            },
            on_conflict="user_id",
        ).execute()

        if created.data:
            return created.data[0]

        return {
            "user_id": user_id,
            "plan_name": settings.RAZORPAY_PLAN_NAME,
            "price": round(settings.RAZORPAY_PLAN_AMOUNT_PAISE / 100, 2),
            "currency": settings.RAZORPAY_CURRENCY,
            "status": "trial",
            "trial_start": now.isoformat(),
            "trial_end": trial_end.isoformat(),
        }

    async def sync_subscription_status(
        self,
        user_id: str,
        subscription: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Keep a subscription's stored status aligned with its dates.

        This protects the dashboard from showing a still-active plan after the
        trial or paid period has already ended.
        """
        sub = dict(subscription or {})
        if not sub:
            result = supabase_client.admin.table("subscriptions").select(
                "*"
            ).eq("user_id", user_id).limit(1).execute()
            if not result.data:
                return await self.get_or_create_subscription(user_id)
            sub = dict(result.data[0])

        now = utc_now()
        current_status = (sub.get("status") or "trial").lower()
        trial_end = parse_datetime_utc(sub.get("trial_end"))
        renewal_date = parse_datetime_utc(sub.get("renewal_date"))

        effective_status = current_status
        if current_status == "trial" and trial_end and trial_end <= now:
            effective_status = "expired"
        elif current_status == "active" and renewal_date and renewal_date <= now:
            effective_status = "expired"

        if effective_status != current_status:
            result = supabase_client.admin.table("subscriptions").update(
                {"status": effective_status}
            ).eq("user_id", user_id).execute()
            if result.data:
                return result.data[0]
            sub["status"] = effective_status

        return sub

    async def create_checkout_order(
        self,
        user_id: str,
        plan_name: Optional[str] = None,
        coupon_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a Razorpay order and persist the pending payment row."""
        self._ensure_configured()

        user = await get_user_by_id(user_id)
        if not user:
            raise RuntimeError("Unable to load your account profile for checkout.")

        subscription = await self.get_or_create_subscription(user_id)
        plan_metadata = self.get_plan_metadata()
        plan_code = plan_name or plan_metadata["plan_name"]
        discount = self.validate_coupon(coupon_code, plan_metadata["amount_paise"])
        final_amount_paise = discount["final_amount_paise"]
        now = utc_now()
        receipt = f"sub_{user_id.replace('-', '')[:16]}_{int(now.timestamp())}"

        order = self._request(
            "POST",
            "/orders",
            payload={
                "amount": final_amount_paise,
                "currency": plan_metadata["currency"],
                "receipt": receipt,
                "notes": {
                    "user_id": user_id,
                    "plan_name": plan_code,
                    "coupon_code": coupon_code or "",
                },
            },
        )

        supabase_client.admin.table("billing_payments").insert(
            {
                "user_id": user_id,
                "provider": "razorpay",
                "plan_name": plan_code,
                "amount": round(final_amount_paise / 100, 2),
                "amount_paise": final_amount_paise,
                "original_amount_paise": plan_metadata["amount_paise"],
                "discount_amount_paise": discount["discount_amount_paise"],
                "final_amount_paise": final_amount_paise,
                "currency": plan_metadata["currency"],
                "status": "created",
                "receipt": receipt,
                "razorpay_order_id": order.get("id"),
                "coupon_code": coupon_code.strip().upper() if coupon_code else None,
                "notes": order.get("notes") or {},
            }
        ).execute()

        return {
            "key_id": settings.RAZORPAY_KEY_ID,
            "order_id": order.get("id"),
            "amount": order.get("amount"),
            "currency": order.get("currency"),
            "name": settings.RAZORPAY_COMPANY_NAME,
            "description": self.get_active_plan().get("checkout_description")
            or settings.RAZORPAY_CHECKOUT_DESCRIPTION,
            "discount_amount_paise": discount["discount_amount_paise"],
            "original_amount_paise": plan_metadata["amount_paise"],
            "prefill": {
                "name": user.get("full_name") or "User",
                "email": user.get("email") or "",
            },
            "notes": order.get("notes") or {},
            "theme": {"color": settings.RAZORPAY_THEME_COLOR},
            "subscription": subscription,
        }

    async def _find_payment_record(
        self,
        *,
        user_id: Optional[str] = None,
        order_id: Optional[str] = None,
        payment_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Look up a payment row by known gateway identifiers."""
        query = supabase_client.admin.table("billing_payments").select("*")
        if payment_id:
            query = query.eq("razorpay_payment_id", payment_id)
        elif order_id:
            query = query.eq("razorpay_order_id", order_id)
        else:
            return None

        if user_id:
            query = query.eq("user_id", user_id)

        result = query.limit(1).execute()
        if result.data:
            return result.data[0]
        return None

    async def _apply_successful_payment(
        self,
        user_id: str,
        payment_row: Dict[str, Any],
        payment_details: Dict[str, Any],
        source: str
    ) -> Dict[str, Any]:
        """
        Activate or extend the user's subscription exactly once per payment.
        """
        if payment_row.get("subscription_applied_at"):
            return await self.get_or_create_subscription(user_id)

        subscription = await self.get_or_create_subscription(user_id)
        now = utc_now()

        current_renewal = parse_datetime_utc(subscription.get("renewal_date"))
        current_trial_end = parse_datetime_utc(subscription.get("trial_end"))

        renewal_anchor = now
        if current_renewal and current_renewal > now:
            renewal_anchor = current_renewal
        elif current_trial_end and current_trial_end > now:
            renewal_anchor = current_trial_end

        plan = self.get_active_plan()
        next_renewal = renewal_anchor + timedelta(days=plan["billing_period_days"])

        subscription_update = {
            "status": "active",
            "plan_name": payment_row.get("plan_name") or settings.RAZORPAY_PLAN_NAME,
            "price": payment_row.get("amount")
            or round(settings.RAZORPAY_PLAN_AMOUNT_PAISE / 100, 2),
            "currency": payment_row.get("currency") or settings.RAZORPAY_CURRENCY,
            "payment_method": payment_details.get("method") or "razorpay",
            "subscription_start": (
                subscription.get("subscription_start") or now.isoformat()
            ),
            "renewal_date": next_renewal.isoformat(),
            "last_payment_date": now.isoformat(),
            "billing_provider": "razorpay",
        }

        updated_subscription = supabase_client.admin.table("subscriptions").update(
            subscription_update
        ).eq("user_id", user_id).execute()

        final_subscription = (
            updated_subscription.data[0]
            if updated_subscription.data
            else {**subscription, **subscription_update}
        )

        payment_patch = {
            "status": payment_details.get("status") or "captured",
            "payment_method": payment_details.get("method"),
            "razorpay_payment_id": payment_details.get("id"),
            "verified_at": now.isoformat(),
            "paid_at": payment_details.get("created_at")
            and now.isoformat()
            or payment_row.get("paid_at"),
            "subscription_applied_at": now.isoformat(),
        }
        supabase_client.admin.table("billing_payments").update(payment_patch).eq(
            "id", payment_row["id"]
        ).execute()

        coupon_code = payment_row.get("coupon_code")
        if coupon_code:
            coupon = supabase_client.admin.table("billing_coupons").select(
                "redeemed_count"
            ).eq("code", coupon_code).limit(1).execute()
            if coupon.data:
                supabase_client.admin.table("billing_coupons").update(
                    {"redeemed_count": int(coupon.data[0].get("redeemed_count") or 0) + 1}
                ).eq("code", coupon_code).execute()

        await log_audit_event(
            user_id=user_id,
            event_type="subscription_payment_verified",
            details={
                "provider": "razorpay",
                "source": source,
                "plan_name": final_subscription.get("plan_name"),
                "renewal_date": final_subscription.get("renewal_date"),
                "razorpay_order_id": payment_row.get("razorpay_order_id"),
                "razorpay_payment_id": payment_details.get("id"),
            },
        )

        return final_subscription

    async def process_successful_payment(
        self,
        *,
        user_id: Optional[str],
        order_id: str,
        payment_id: str,
        checkout_signature: Optional[str] = None,
        trust_gateway_signature: bool = False,
        source: str = "checkout",
    ) -> Dict[str, Any]:
        """Verify, capture, and apply a successful payment."""
        payment_row = await self._find_payment_record(
            user_id=user_id,
            order_id=order_id,
            payment_id=payment_id,
        )

        if not payment_row:
            raise RuntimeError("We could not match this payment to your account.")

        resolved_user_id = payment_row.get("user_id")
        if user_id and resolved_user_id and resolved_user_id != user_id:
            raise RuntimeError("This payment does not belong to the signed-in user.")

        if not trust_gateway_signature:
            if not checkout_signature:
                raise RuntimeError("Missing Razorpay checkout signature.")
            if not self.verify_checkout_signature(order_id, payment_id, checkout_signature):
                supabase_client.admin.table("billing_payments").update(
                    {
                        "status": "failed",
                        "error_message": "Razorpay signature verification failed",
                    }
                ).eq("id", payment_row["id"]).execute()
                raise RuntimeError("Razorpay signature verification failed.")

        payment_details = self._request("GET", f"/payments/{payment_id}")
        if payment_details.get("order_id") != order_id:
            raise RuntimeError("Payment/order mismatch received from Razorpay.")

        if payment_details.get("status") == "authorized":
            payment_details = self._request(
                "POST",
                f"/payments/{payment_id}/capture",
                payload={
                    "amount": int(payment_details.get("amount") or payment_row.get("amount_paise")),
                    "currency": payment_details.get("currency") or payment_row.get("currency"),
                },
            )

        if payment_details.get("status") != "captured":
            raise RuntimeError(
                "Payment was created but not captured. Please check your Razorpay "
                "auto-capture settings and try again."
            )

        now = utc_now().isoformat()
        updated_payment_result = supabase_client.admin.table("billing_payments").update(
            {
                "status": payment_details.get("status"),
                "razorpay_payment_id": payment_details.get("id"),
                "razorpay_signature": checkout_signature,
                "payment_method": payment_details.get("method"),
                "verified_at": now,
                "paid_at": now,
                "error_message": None,
            }
        ).eq("id", payment_row["id"]).execute()

        updated_payment_row = (
            updated_payment_result.data[0]
            if updated_payment_result.data
            else {**payment_row, "paid_at": now, "verified_at": now}
        )

        subscription = await self._apply_successful_payment(
            resolved_user_id,
            updated_payment_row,
            payment_details,
            source,
        )

        return {
            "success": True,
            "message": "Payment verified successfully.",
            "subscription": subscription,
            "payment": updated_payment_row,
        }

    async def mark_payment_failed(
        self,
        *,
        order_id: Optional[str],
        payment_id: Optional[str],
        reason: Optional[str] = None
    ) -> None:
        """Mark a pending payment as failed from a webhook event."""
        payment_row = await self._find_payment_record(
            order_id=order_id,
            payment_id=payment_id,
        )
        if not payment_row:
            return

        supabase_client.admin.table("billing_payments").update(
            {
                "status": "failed",
                "error_message": reason or "Payment failed on Razorpay",
            }
        ).eq("id", payment_row["id"]).execute()

    async def process_webhook(
        self,
        *,
        raw_body: bytes,
        signature: str,
        event_id: Optional[str],
    ) -> Dict[str, Any]:
        """Handle and persist Razorpay webhooks."""
        if not self.verify_webhook_signature(raw_body, signature):
            raise RuntimeError("Invalid Razorpay webhook signature.")

        payload = json.loads(raw_body.decode("utf-8"))
        event_type = payload.get("event") or "unknown"

        if event_id:
            existing = supabase_client.admin.table("billing_webhook_events").select(
                "id"
            ).eq("event_id", event_id).limit(1).execute()
            if existing.data:
                return {"duplicate": True, "event": event_type}

        if event_id:
            supabase_client.admin.table("billing_webhook_events").insert(
                {
                    "provider": "razorpay",
                    "event_id": event_id,
                    "event_type": event_type,
                    "payload": payload,
                }
            ).execute()

        payment_entity = (payload.get("payload", {}).get("payment") or {}).get(
            "entity", {}
        )
        order_entity = (payload.get("payload", {}).get("order") or {}).get(
            "entity", {}
        )

        order_id = (
            payment_entity.get("order_id")
            or order_entity.get("id")
        )
        payment_id = payment_entity.get("id")
        notes = order_entity.get("notes") or payment_entity.get("notes") or {}

        if event_type in {"payment.captured", "order.paid"} and order_id and payment_id:
            await self.process_successful_payment(
                user_id=notes.get("user_id"),
                order_id=order_id,
                payment_id=payment_id,
                trust_gateway_signature=True,
                source="webhook",
            )
        elif event_type == "payment.failed":
            error_reason = (
                (payload.get("payload", {}).get("payment", {}).get("entity", {}).get("error_description"))
                or "Payment failed on Razorpay"
            )
            await self.mark_payment_failed(
                order_id=order_id,
                payment_id=payment_id,
                reason=error_reason,
            )

        return {"ok": True, "event": event_type}


billing_service = BillingService()
