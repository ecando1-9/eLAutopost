-- ============================================================
-- Migration: Add engagement metrics to posts table
-- ============================================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impressions_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_stats_update TIMESTAMP WITH TIME ZONE;

-- Optional: Reset stats for all posts
UPDATE posts SET likes_count = 0, comments_count = 0, shares_count = 0, impressions_count = 0 
WHERE likes_count IS NULL;
