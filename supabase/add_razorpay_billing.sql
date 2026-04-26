-- ============================================================================
-- Razorpay billing support
-- ============================================================================
-- Run this after the existing schema/admin migrations.
-- It adds payment tracking tables plus a safer subscription access check so
-- paid plans expire correctly when the renewal date passes.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- SUBSCRIPTION BILLING METADATA
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS billing_provider VARCHAR(30);

UPDATE public.subscriptions
SET billing_provider = COALESCE(billing_provider, 'razorpay')
WHERE status IN ('active', 'cancelled', 'expired')
  AND billing_provider IS NULL;

-- ---------------------------------------------------------------------------
-- PAYMENTS TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL DEFAULT 'razorpay',
    plan_name VARCHAR(50) NOT NULL DEFAULT 'monthly',
    amount DECIMAL(10, 2) NOT NULL,
    amount_paise INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
    receipt VARCHAR(80),
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    razorpay_signature TEXT,
    payment_method VARCHAR(50),
    notes JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    subscription_applied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments"
    ON public.payments FOR SELECT
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_payments_user_id
    ON public.payments (user_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
    ON public.payments (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_order_id_unique
    ON public.payments (razorpay_order_id)
    WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id_unique
    ON public.payments (razorpay_payment_id)
    WHERE razorpay_payment_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- WEBHOOK EVENT DEDUPLICATION
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(30) NOT NULL DEFAULT 'razorpay',
    event_id VARCHAR(100) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_provider
    ON public.billing_webhook_events (provider, created_at DESC);

-- ---------------------------------------------------------------------------
-- EXPIRE TRIALS / PAID PLANS WHEN DATE WINDOW ENDS
-- ---------------------------------------------------------------------------
UPDATE public.subscriptions
SET status = 'expired'
WHERE status = 'trial'
  AND trial_end IS NOT NULL
  AND trial_end <= NOW();

UPDATE public.subscriptions
SET status = 'expired'
WHERE status = 'active'
  AND renewal_date IS NOT NULL
  AND renewal_date <= NOW();

CREATE OR REPLACE FUNCTION public.has_active_subscription(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sub_status VARCHAR(20);
    trial_end_date TIMESTAMP WITH TIME ZONE;
    renewal_due TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT status, trial_end, renewal_date
    INTO sub_status, trial_end_date, renewal_due
    FROM public.subscriptions
    WHERE user_id = check_user_id;

    IF sub_status IS NULL THEN
        RETURN FALSE;
    END IF;

    IF sub_status = 'trial' THEN
        IF trial_end_date IS NOT NULL AND trial_end_date > NOW() THEN
            RETURN TRUE;
        END IF;

        UPDATE public.subscriptions
        SET status = 'expired'
        WHERE user_id = check_user_id
          AND status = 'trial';

        RETURN FALSE;
    END IF;

    IF sub_status = 'active' THEN
        IF renewal_due IS NULL OR renewal_due > NOW() THEN
            RETURN TRUE;
        END IF;

        UPDATE public.subscriptions
        SET status = 'expired'
        WHERE user_id = check_user_id
          AND status = 'active';

        RETURN FALSE;
    END IF;

    RETURN FALSE;
END;
$$;
