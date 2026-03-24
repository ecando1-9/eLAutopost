-- Update default trial duration for new users to 30 days
-- Safe to run multiple times.

CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.subscriptions (user_id, plan_name, price, status, trial_start, trial_end)
    VALUES (NEW.id, 'monthly', 299.00, 'trial', NOW(), NOW() + INTERVAL '30 days')
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.usage_metrics (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Optional: extend active trial users who currently have less than 30 days total trial window
UPDATE public.subscriptions
SET trial_end = trial_start + INTERVAL '30 days'
WHERE status = 'trial'
  AND trial_start IS NOT NULL
  AND trial_end IS NOT NULL
  AND trial_end < trial_start + INTERVAL '30 days';

