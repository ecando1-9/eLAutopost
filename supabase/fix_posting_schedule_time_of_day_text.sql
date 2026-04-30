-- Allow multiple schedule slots such as '09:00,16:45'.
-- Safe to run on databases where time_of_day is already TEXT.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'posting_schedules'
          AND column_name = 'time_of_day'
          AND data_type <> 'text'
    ) THEN
        ALTER TABLE public.posting_schedules
            ALTER COLUMN time_of_day TYPE TEXT
            USING to_char(time_of_day::time, 'HH24:MI');
    END IF;
END $$;
