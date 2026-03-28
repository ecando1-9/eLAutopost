-- ============================================================
-- Migration: Add new post statuses for improved workflow
-- 
-- Adds:
--   1. 'running'      → Prevents double-posting when worker runs
--   2. 'pending_review' → Auto-generated posts needing user approval
--
-- Run this in Supabase SQL Editor (Dashboard > SQL)
-- ============================================================

-- Step 1: Check if the status column uses a CHECK constraint (not enum)
-- If your posts table has: status VARCHAR with CHECK, run this:

ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS posts_status_check;

ALTER TABLE posts
  ADD CONSTRAINT posts_status_check CHECK (
    status IN (
      'draft',
      'pending_review',
      'scheduled',
      'running',
      'pending',
      'posted',
      'failed'
    )
  );

-- Step 2: Add retry_count column if missing (for exponential backoff)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Step 3: Add error_message column if missing
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Step 4: Add index for the posting worker query performance
-- (finds scheduled posts due for posting quickly)
CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled_at
  ON posts (status, scheduled_at)
  WHERE status = 'scheduled';

-- Step 5: Add index for dashboard - pending posts count
CREATE INDEX IF NOT EXISTS idx_posts_user_status
  ON posts (user_id, status);

-- Step 6: Add index for today's posts count
CREATE INDEX IF NOT EXISTS idx_posts_posted_at
  ON posts (user_id, posted_at)
  WHERE status = 'posted';

-- ============================================================
-- OPTIONAL: Reset any stuck 'running' posts back to 'failed'
-- Run this if you have any posts stuck in 'running' status
-- from before this fix was applied:
-- ============================================================
-- UPDATE posts
--   SET status = 'failed',
--       error_message = 'Reset from stuck running state'
--   WHERE status = 'running'
--   AND updated_at < (NOW() - INTERVAL '30 minutes');

-- ============================================================
-- Verify the constraint was applied:
-- ============================================================
-- SELECT conname, consrc
-- FROM pg_constraint
-- WHERE conrelid = 'posts'::regclass
-- AND contype = 'c';
