-- Persist AI presentation preferences used by automation defaults.
-- Safe to run multiple times.

ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS emoji_density VARCHAR(10) DEFAULT 'Medium',
    ADD COLUMN IF NOT EXISTS auto_format_reach BOOLEAN DEFAULT TRUE;

UPDATE public.settings
SET
    emoji_density = CASE
        WHEN lower(COALESCE(NULLIF(btrim(emoji_density), ''), 'medium')) = 'none' THEN 'None'
        WHEN lower(COALESCE(NULLIF(btrim(emoji_density), ''), 'medium')) = 'low' THEN 'Low'
        WHEN lower(COALESCE(NULLIF(btrim(emoji_density), ''), 'medium')) = 'high' THEN 'High'
        ELSE 'Medium'
    END,
    auto_format_reach = COALESCE(auto_format_reach, TRUE);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'settings_emoji_density_check'
          AND conrelid = 'public.settings'::regclass
    ) THEN
        ALTER TABLE public.settings
            ADD CONSTRAINT settings_emoji_density_check
            CHECK (emoji_density IN ('None', 'Low', 'Medium', 'High')) NOT VALID;
    END IF;
END;
$$;

ALTER TABLE public.settings
    VALIDATE CONSTRAINT settings_emoji_density_check;
