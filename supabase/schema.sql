-- ============================================================================
-- LinkedIn Automation SaaS - Database Schema
-- ============================================================================
-- This schema implements a secure, multi-tenant architecture with:
-- - Row Level Security (RLS) on all tables
-- - Proper indexes for performance
-- - Foreign key constraints for data integrity
-- - Audit logging for compliance
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores user profile information
-- Links to Supabase Auth users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    auth_provider VARCHAR(50) DEFAULT 'email',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Users can only read their own data
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- LINKEDIN_TOKENS TABLE
-- ============================================================================
-- Stores LinkedIn OAuth tokens securely
-- Encrypted at rest by Supabase
CREATE TABLE IF NOT EXISTS linkedin_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE linkedin_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for linkedin_tokens
-- Users can only access their own tokens
CREATE POLICY "Users can view own tokens"
    ON linkedin_tokens FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
    ON linkedin_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
    ON linkedin_tokens FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
    ON linkedin_tokens FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_linkedin_tokens_user_id ON linkedin_tokens(user_id);
CREATE INDEX idx_linkedin_tokens_expires_at ON linkedin_tokens(expires_at);

-- ============================================================================
-- SETTINGS TABLE
-- ============================================================================
-- User preferences and settings
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    default_tone VARCHAR(50) DEFAULT 'professional',
    auto_post BOOLEAN DEFAULT FALSE,
    notification_email BOOLEAN DEFAULT TRUE,
    preferred_content_types TEXT[], -- Array of content types
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for settings
CREATE POLICY "Users can view own settings"
    ON settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
    ON settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON settings FOR UPDATE
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_settings_user_id ON settings(user_id);

-- ============================================================================
-- POSTS TABLE
-- ============================================================================
-- Stores generated content and post history
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(200) NOT NULL,
    hook VARCHAR(100) NOT NULL,
    image_prompt TEXT NOT NULL,
    caption TEXT NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('alert', 'curiosity', 'insight', 'future')),
    image_url TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'posted', 'failed')),
    linkedin_post_id VARCHAR(255),
    linkedin_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    posted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for posts
CREATE POLICY "Users can view own posts"
    ON posts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own posts"
    ON posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
    ON posts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
    ON posts FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_content_type ON posts(content_type);

-- ============================================================================
-- AUDIT_LOGS TABLE
-- ============================================================================
-- Security and compliance audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
-- Users can only view their own audit logs
CREATE POLICY "Users can view own audit logs"
    ON audit_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Only system can insert audit logs (via service role)
-- No policy needed - will be done via service role key

-- Indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
-- SECURITY: search_path set to prevent injection
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_linkedin_tokens_updated_at
    BEFORE UPDATE ON linkedin_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- User dashboard view with aggregated stats
-- SECURITY: Uses SECURITY INVOKER to respect RLS policies
CREATE OR REPLACE VIEW user_dashboard
WITH (security_invoker = true)
AS
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.created_at,
    COUNT(DISTINCT p.id) as total_posts,
    COUNT(DISTINCT CASE WHEN p.status = 'posted' THEN p.id END) as posted_count,
    COUNT(DISTINCT CASE WHEN p.status = 'draft' THEN p.id END) as draft_count,
    MAX(p.posted_at) as last_post_date,
    EXISTS(SELECT 1 FROM linkedin_tokens lt WHERE lt.user_id = u.id AND lt.expires_at > NOW()) as linkedin_connected
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
GROUP BY u.id, u.email, u.full_name, u.created_at;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Create default settings for new users (via trigger)
-- SECURITY: search_path set to prevent injection
CREATE OR REPLACE FUNCTION create_default_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER create_user_settings
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_settings();

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================
-- 1. All tables have RLS enabled
-- 2. Users can only access their own data (multi-tenant isolation)
-- 3. Service role key required for admin operations
-- 4. Audit logs track all security events
-- 5. Tokens encrypted at rest by Supabase
-- 6. Foreign keys ensure referential integrity
-- 7. Indexes optimize query performance
-- ============================================================================
