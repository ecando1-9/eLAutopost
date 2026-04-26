"""
Billing API routes for Razorpay checkout.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..middleware.admin_auth import get_current_user_id
from ..middleware.rate_limit import limiter
from ..models.schemas import (
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingPlan,
    BillingVerifyRequest,
    BillingVerifyResponse,
)
from ..services.billing import billing_service
from ..core.config import logger


router = APIRouter()


@router.get("/plan", response_model=BillingPlan)
@limiter.limit("60/minute")
async def get_billing_plan(
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """Return public billing metadata for the signed-in user."""
    _ = user_id
    return BillingPlan(**billing_service.get_plan_metadata())


@router.post("/create-order", response_model=BillingCheckoutResponse)
@limiter.limit("10/minute")
async def create_billing_order(
    request: Request,
    body: BillingCheckoutRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Create a Razorpay checkout order for the current user."""
    try:
        payload = await billing_service.create_checkout_order(
            user_id=user_id,
            plan_name=body.plan_name,
        )
        return BillingCheckoutResponse(**payload)
    except RuntimeError as e:
        logger.warning(f"Billing order creation failed for {user_id}: {e}")
        status_code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if "not configured" in str(e).lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected billing order error for {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create Razorpay order",
        )


@router.post("/verify", response_model=BillingVerifyResponse)
@limiter.limit("20/minute")
async def verify_billing_payment(
    request: Request,
    body: BillingVerifyRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Verify Razorpay checkout success and activate the subscription."""
    try:
        result = await billing_service.process_successful_payment(
            user_id=user_id,
            order_id=body.razorpay_order_id,
            payment_id=body.razorpay_payment_id,
            checkout_signature=body.razorpay_signature,
            source="checkout",
        )
        return BillingVerifyResponse(**result)
    except RuntimeError as e:
        logger.warning(f"Billing verification failed for {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Unexpected billing verify error for {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify Razorpay payment",
        )


@router.post("/webhooks/razorpay")
@limiter.limit("120/minute")
async def handle_razorpay_webhook(request: Request):
    """Validate and process Razorpay webhooks."""
    signature = request.headers.get("x-razorpay-signature", "")
    event_id = request.headers.get("x-razorpay-event-id")
    raw_body = await request.body()

    try:
        result = await billing_service.process_webhook(
            raw_body=raw_body,
            signature=signature,
            event_id=event_id,
        )
        return {"success": True, **result}
    except RuntimeError as e:
        logger.warning(f"Rejected Razorpay webhook: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Unexpected Razorpay webhook error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process Razorpay webhook",
        )
