# Razorpay Setup

1. Run the Supabase migration file `supabase/add_razorpay_billing.sql`.
2. Add these backend environment variables:

```env
RAZORPAY_KEY_ID=rzp_live_or_test_key
RAZORPAY_KEY_SECRET=your_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
RAZORPAY_CURRENCY=INR
RAZORPAY_PLAN_NAME=monthly
RAZORPAY_PLAN_LABEL=Monthly Pro
RAZORPAY_PLAN_AMOUNT_PAISE=29900
RAZORPAY_COMPANY_NAME=eLAutopost AI
RAZORPAY_CHECKOUT_DESCRIPTION=Monthly LinkedIn automation subscription
RAZORPAY_THEME_COLOR=#2563eb
```

3. In Razorpay Dashboard, create a webhook pointing to:

```text
https://YOUR_BACKEND_DOMAIN/api/v1/billing/webhooks/razorpay
```

4. Subscribe the webhook to at least these events:

```text
payment.captured
payment.failed
order.paid
```

5. Keep payment auto-capture enabled in Razorpay, or let the backend capture authorized payments after checkout verification.
