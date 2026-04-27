-- ============================================================================
-- Admin billing controls: editable Razorpay plan + coupons
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.billing_plan_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_name VARCHAR(50) NOT NULL UNIQUE DEFAULT 'monthly',
    display_name VARCHAR(100) NOT NULL DEFAULT 'Monthly Pro',
    amount_paise INTEGER NOT NULL CHECK (amount_paise >= 100),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    billing_period_days INTEGER NOT NULL DEFAULT 30 CHECK (billing_period_days >= 1),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    checkout_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.billing_plan_settings (
    plan_name,
    display_name,
    amount_paise,
    currency,
    billing_period_days,
    checkout_description
)
VALUES (
    'monthly',
    'Monthly Pro',
    29900,
    'INR',
    30,
    'Monthly LinkedIn automation subscription'
)
ON CONFLICT (plan_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.billing_coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(40) NOT NULL UNIQUE,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value INTEGER NOT NULL CHECK (discount_value > 0),
    max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
    redeemed_count INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.billing_payments
    ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(40),
    ADD COLUMN IF NOT EXISTS discount_amount_paise INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS original_amount_paise INTEGER;

ALTER TABLE public.billing_payments
    ADD COLUMN IF NOT EXISTS final_amount_paise INTEGER;

UPDATE public.billing_payments
SET original_amount_paise = COALESCE(original_amount_paise, amount_paise),
    final_amount_paise = COALESCE(final_amount_paise, amount_paise)
WHERE original_amount_paise IS NULL
   OR final_amount_paise IS NULL;

ALTER TABLE public.billing_plan_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage billing plan settings" ON public.billing_plan_settings;
CREATE POLICY "Admins can manage billing plan settings"
    ON public.billing_plan_settings FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage billing coupons" ON public.billing_coupons;
CREATE POLICY "Admins can manage billing coupons"
    ON public.billing_coupons FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_billing_coupons_code
    ON public.billing_coupons (code);

CREATE INDEX IF NOT EXISTS idx_billing_coupons_active
    ON public.billing_coupons (is_active, ends_at);

DROP TRIGGER IF EXISTS update_billing_plan_settings_updated_at ON public.billing_plan_settings;
CREATE TRIGGER update_billing_plan_settings_updated_at
    BEFORE UPDATE ON public.billing_plan_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_coupons_updated_at ON public.billing_coupons;
CREATE TRIGGER update_billing_coupons_updated_at
    BEFORE UPDATE ON public.billing_coupons
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP VIEW IF EXISTS public.admin_dashboard_stats;
DROP VIEW IF EXISTS public.admin_revenue_analytics;

CREATE OR REPLACE VIEW public.admin_dashboard_stats
WITH (security_invoker = true)
AS
SELECT
    (SELECT COUNT(*) FROM public.users) as total_users,
    (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active') as active_subscribers,
    (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'trial' AND trial_end > NOW()) as trial_users,
    (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'expired') as expired_trials,
    (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'blocked') as blocked_users,
    COALESCE((SELECT SUM(price) FROM public.subscriptions WHERE status = 'active'), 0) as mrr,
    (SELECT COUNT(*) FROM public.users WHERE created_at > NOW() - INTERVAL '30 days') as new_users_this_month,
    (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active' AND subscription_start > NOW() - INTERVAL '30 days') as new_subscribers_this_month;

CREATE OR REPLACE VIEW public.admin_revenue_analytics
WITH (security_invoker = true)
AS
SELECT
    DATE_TRUNC('month', COALESCE(p.paid_at, p.verified_at, p.created_at)) as month,
    COUNT(DISTINCT p.user_id) as new_subscriptions,
    SUM(COALESCE(p.final_amount_paise, p.amount_paise, 0)) / 100.0 as revenue,
    SUM(COALESCE(p.final_amount_paise, p.amount_paise, 0)) / 100.0 as mrr_added
FROM public.billing_payments p
WHERE p.status = 'captured'
GROUP BY DATE_TRUNC('month', COALESCE(p.paid_at, p.verified_at, p.created_at))
ORDER BY month DESC;
