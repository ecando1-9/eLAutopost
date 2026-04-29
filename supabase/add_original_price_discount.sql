-- ============================================================================
-- Add original_amount_paise to billing_plan_settings for discount display
-- Run this in Supabase SQL Editor
-- ============================================================================

ALTER TABLE public.billing_plan_settings
    ADD COLUMN IF NOT EXISTS original_amount_paise INTEGER;

-- Set current plan prices with discounts:
-- Pro:     ₹299 original → ₹199 actual (33% off)
-- Starter: ₹149 original → ₹77 actual  (48% off)
UPDATE public.billing_plan_settings
SET
    original_amount_paise = 29900,   -- ₹299 crossed out
    amount_paise          = 19900,   -- ₹199 actual charge
    display_name          = 'Pro Growth Engine',
    features = '[
        "Full AI Strategy Engine",
        "Smart Auto-Post Scheduler",
        "Premium PDF Carousels",
        "30-Day Content Calendar",
        "Engagement Scoring",
        "Priority Support"
    ]'::jsonb,
    is_popular = TRUE
WHERE plan_name = 'pro';

UPDATE public.billing_plan_settings
SET
    original_amount_paise = 14900,   -- ₹149 crossed out
    amount_paise          = 7700,    -- ₹77 actual charge
    display_name          = 'Starter',
    features = '[
        "1 Post Per Day",
        "Basic AI Content",
        "Manual Publishing",
        "Email Support"
    ]'::jsonb,
    is_popular = FALSE
WHERE plan_name = 'starter';
