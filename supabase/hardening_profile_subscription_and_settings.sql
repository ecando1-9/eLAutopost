-- Data hardening patch for production:
-- 1) Ensure settings table stores all configurable defaults.
-- 2) Backfill missing subscription start/end dates.
-- 3) Normalize placeholder/blank full names.
-- 4) Ensure posts scheduling columns/constraints are compatible with app logic.
-- Safe to run multiple times.

-- ---------------------------------------------------------------------------
-- SETTINGS COLUMN HARDENING
-- ---------------------------------------------------------------------------
ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS default_goal VARCHAR(80) DEFAULT 'Authority',
    ADD COLUMN IF NOT EXISTS default_audience VARCHAR(120) DEFAULT 'General Professionals',
    ADD COLUMN IF NOT EXISTS default_style VARCHAR(120) DEFAULT 'Carousel slides',
    ADD COLUMN IF NOT EXISTS publish_target VARCHAR(20) DEFAULT 'person',
    ADD COLUMN IF NOT EXISTS organization_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS max_posts_per_day INTEGER DEFAULT 3;

UPDATE public.settings
SET
    default_goal = COALESCE(NULLIF(btrim(default_goal), ''), 'Authority'),
    default_audience = COALESCE(NULLIF(btrim(default_audience), ''), 'General Professionals'),
    default_style = COALESCE(NULLIF(btrim(default_style), ''), 'Carousel slides'),
    publish_target = CASE
        WHEN publish_target IN ('person', 'organization', 'both') THEN publish_target
        ELSE 'person'
    END,
    max_posts_per_day = CASE
        WHEN max_posts_per_day IS NULL OR max_posts_per_day < 1 THEN 3
        WHEN max_posts_per_day > 10 THEN 10
        ELSE max_posts_per_day
    END;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'settings_publish_target_check'
          AND conrelid = 'public.settings'::regclass
    ) THEN
        ALTER TABLE public.settings
            ADD CONSTRAINT settings_publish_target_check
            CHECK (publish_target IN ('person', 'organization', 'both')) NOT VALID;
    END IF;
END;
$$;

ALTER TABLE public.settings
    VALIDATE CONSTRAINT settings_publish_target_check;

-- ---------------------------------------------------------------------------
-- POSTS SCHEDULER COLUMN + CONSTRAINT HARDENING
-- ---------------------------------------------------------------------------
ALTER TABLE public.posts
    ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Replace legacy status check to support both pending and scheduled states.
ALTER TABLE public.posts
    DROP CONSTRAINT IF EXISTS posts_status_check;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'posts_status_check'
          AND conrelid = 'public.posts'::regclass
    ) THEN
        ALTER TABLE public.posts
            ADD CONSTRAINT posts_status_check
            CHECK (status IN ('draft', 'pending', 'scheduled', 'posted', 'failed')) NOT VALID;
    END IF;
END;
$$;

ALTER TABLE public.posts
    VALIDATE CONSTRAINT posts_status_check;

CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at
    ON public.posts (scheduled_at)
    WHERE status = 'scheduled';

-- ---------------------------------------------------------------------------
-- USER NAME NORMALIZATION
-- ---------------------------------------------------------------------------
UPDATE public.users u
SET full_name = INITCAP(
    REPLACE(REPLACE(REPLACE(split_part(u.email, '@', 1), '.', ' '), '_', ' '), '-', ' ')
)
WHERE
    u.email IS NOT NULL
    AND (
        u.full_name IS NULL
        OR btrim(u.full_name) = ''
        OR lower(btrim(u.full_name)) IN (
            'your_name_here',
            'your email here',
            'your_email_here',
            'full name',
            'name',
            'test user'
        )
        OR lower(btrim(u.full_name)) = lower(btrim(u.email))
    );

-- ---------------------------------------------------------------------------
-- SUBSCRIPTION DATE BACKFILL
-- ---------------------------------------------------------------------------
-- Ensure trial users always have start and end dates.
UPDATE public.subscriptions
SET trial_start = COALESCE(trial_start, created_at, NOW())
WHERE status = 'trial'
  AND trial_start IS NULL;

UPDATE public.subscriptions
SET trial_end = COALESCE(trial_end, trial_start + INTERVAL '30 days', NOW() + INTERVAL '30 days')
WHERE status = 'trial'
  AND trial_end IS NULL;

-- Ensure active users always have subscription start + renewal date.
UPDATE public.subscriptions
SET subscription_start = COALESCE(subscription_start, created_at, NOW())
WHERE status IN ('active', 'cancelled', 'expired', 'blocked')
  AND subscription_start IS NULL;

UPDATE public.subscriptions
SET renewal_date = COALESCE(renewal_date, subscription_start + INTERVAL '30 days', NOW() + INTERVAL '30 days')
WHERE status IN ('active', 'cancelled', 'expired', 'blocked')
  AND renewal_date IS NULL;

-- ---------------------------------------------------------------------------
-- AUTH.USER CREATION FUNCTION HARDENING (name fallback)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    resolved_name TEXT;
BEGIN
    resolved_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), '');

    IF resolved_name = '' OR lower(resolved_name) IN (
        'your_name_here',
        'your email here',
        'your_email_here',
        'full name',
        'name',
        'test user'
    ) OR lower(resolved_name) = lower(COALESCE(NEW.email, '')) THEN
        resolved_name := INITCAP(
            REPLACE(REPLACE(REPLACE(split_part(COALESCE(NEW.email, ''), '@', 1), '.', ' '), '_', ' '), '-', ' ')
        );
    END IF;

    IF resolved_name = '' THEN
        resolved_name := 'User';
    END IF;

    INSERT INTO public.users (id, email, full_name, auth_provider)
    VALUES (
        NEW.id,
        NEW.email,
        resolved_name,
        COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = CASE
            WHEN public.users.full_name IS NULL OR btrim(public.users.full_name) = '' THEN EXCLUDED.full_name
            ELSE public.users.full_name
        END,
        auth_provider = EXCLUDED.auth_provider;

    INSERT INTO public.settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.subscriptions (
        user_id,
        plan_name,
        price,
        status,
        trial_start,
        trial_end
    )
    VALUES (
        NEW.id,
        'monthly',
        299.00,
        'trial',
        NOW(),
        NOW() + INTERVAL '30 days'
    )
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
