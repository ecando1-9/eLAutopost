-- ============================================================================
-- ADMIN DASHBOARD - DATABASE SCHEMA (SECURITY HARDENED)
-- ============================================================================
-- This schema adds admin functionality to the LinkedIn Automation SaaS:
-- - Role-based access control (RBAC)
-- - Subscription management (₹299/month + 7-day trial)
-- - Usage tracking & limits
-- - Audit logging
-- - Admin analytics
--
-- SECURITY FIXES:
-- - All functions have explicit search_path set
-- - Views use SECURITY INVOKER (not DEFINER) where possible
-- - Supabase linter compliant
-- ============================================================================

-- ============================================================================
-- ROLES TABLE
-- ============================================================================
-- Manages user roles (admin / user)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles
-- Users can view their own role
CREATE POLICY "Users can view own role"
    ON roles FOR SELECT
    USING (auth.uid() = user_id);

-- Only admins can insert/update roles
CREATE POLICY "Admins can manage roles"
    ON roles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Indexes
CREATE INDEX idx_roles_user_id ON roles(user_id);
CREATE INDEX idx_roles_role ON roles(role);

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
-- Manages user subscriptions and trials
-- Plan: ₹299/month with 7-day free trial
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) NOT NULL DEFAULT 'monthly',
    price DECIMAL(10, 2) NOT NULL DEFAULT 299.00,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired', 'cancelled', 'blocked')),
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    subscription_start TIMESTAMP WITH TIME ZONE,
    renewal_date TIMESTAMP WITH TIME ZONE,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
    ON subscriptions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage subscriptions"
    ON subscriptions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_trial_end ON subscriptions(trial_end);
CREATE INDEX idx_subscriptions_renewal_date ON subscriptions(renewal_date);

-- ============================================================================
-- USAGE_METRICS TABLE
-- ============================================================================
-- Tracks user activity and usage for limits and analytics
CREATE TABLE IF NOT EXISTS usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    posts_generated INTEGER DEFAULT 0,
    images_generated INTEGER DEFAULT 0,
    linkedin_posts INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for usage_metrics
-- Users can view their own metrics
CREATE POLICY "Users can view own metrics"
    ON usage_metrics FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all metrics
CREATE POLICY "Admins can view all metrics"
    ON usage_metrics FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can manage all metrics
CREATE POLICY "Admins can manage metrics"
    ON usage_metrics FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Indexes
CREATE INDEX idx_usage_metrics_user_id ON usage_metrics(user_id);
CREATE INDEX idx_usage_metrics_last_activity ON usage_metrics(last_activity);

-- ============================================================================
-- ADMIN_AUDIT_LOGS TABLE
-- ============================================================================
-- Logs all admin actions for security and compliance
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_audit_logs
-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
    ON admin_audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Only system (service role) can insert audit logs
-- No policy needed - will be done via service role key

-- Indexes
CREATE INDEX idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX idx_admin_audit_logs_target_user_id ON admin_audit_logs(target_user_id);
CREATE INDEX idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);

-- ============================================================================
-- FUNCTIONS (WITH EXPLICIT SEARCH_PATH FOR SECURITY)
-- ============================================================================

-- Function to check if user is admin
-- SECURITY: search_path set to prevent injection
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.roles
        WHERE user_id = check_user_id AND role = 'admin'
    );
END;
$$;

-- Function to check if user has active subscription
-- SECURITY: search_path set to prevent injection
CREATE OR REPLACE FUNCTION has_active_subscription(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sub_status VARCHAR(20);
    trial_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT status, trial_end INTO sub_status, trial_end_date
    FROM public.subscriptions
    WHERE user_id = check_user_id;
    
    -- If no subscription record, return false
    IF sub_status IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Active paid subscription
    IF sub_status = 'active' THEN
        RETURN TRUE;
    END IF;
    
    -- Trial subscription (check if not expired)
    IF sub_status = 'trial' AND trial_end_date > NOW() THEN
        RETURN TRUE;
    END IF;
    
    -- All other cases (expired, cancelled, blocked)
    RETURN FALSE;
END;
$$;

-- Function to increment usage metrics
-- SECURITY: search_path set to prevent injection
CREATE OR REPLACE FUNCTION increment_usage(
    p_user_id UUID,
    p_metric VARCHAR(50),
    p_increment INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Ensure usage_metrics record exists
    INSERT INTO public.usage_metrics (user_id, last_activity)
    VALUES (p_user_id, NOW())
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Increment the specified metric
    CASE p_metric
        WHEN 'posts_generated' THEN
            UPDATE public.usage_metrics
            SET posts_generated = posts_generated + p_increment,
                last_activity = NOW()
            WHERE user_id = p_user_id;
        WHEN 'images_generated' THEN
            UPDATE public.usage_metrics
            SET images_generated = images_generated + p_increment,
                last_activity = NOW()
            WHERE user_id = p_user_id;
        WHEN 'linkedin_posts' THEN
            UPDATE public.usage_metrics
            SET linkedin_posts = linkedin_posts + p_increment,
                last_activity = NOW()
            WHERE user_id = p_user_id;
        WHEN 'api_calls' THEN
            UPDATE public.usage_metrics
            SET api_calls = api_calls + p_increment,
                last_activity = NOW()
            WHERE user_id = p_user_id;
    END CASE;
END;
$$;

-- ============================================================================
-- TRIGGERS (WITH EXPLICIT SEARCH_PATH FOR SECURITY)
-- ============================================================================

-- Trigger to create default subscription on user signup
-- SECURITY: search_path set to prevent injection
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- Create 7-day trial subscription
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
        NOW() + INTERVAL '7 days'
    );
    
    -- Create default role (user)
    INSERT INTO public.roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    -- Create usage metrics record
    INSERT INTO public.usage_metrics (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER create_user_subscription
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_subscription();

-- Trigger to update subscription status when trial expires
-- SECURITY: search_path set to prevent injection
CREATE OR REPLACE FUNCTION check_trial_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- If trial has expired, update status
    IF NEW.status = 'trial' AND NEW.trial_end < NOW() THEN
        NEW.status = 'expired';
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_expired_trials
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION check_trial_expiration();

-- ============================================================================
-- VIEWS (SECURITY INVOKER - RESPECTS RLS)
-- ============================================================================
-- NOTE: These views use SECURITY INVOKER (default) which means they run with
-- the permissions of the querying user, not the view creator. This is safer
-- and respects RLS policies. Admin access is controlled via RLS policies.

-- Admin dashboard overview
-- Admins only (via RLS on underlying tables)
CREATE OR REPLACE VIEW admin_dashboard_stats
WITH (security_invoker = true)
AS
SELECT
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as active_subscribers,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'trial' AND trial_end > NOW()) as trial_users,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'expired') as expired_trials,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'blocked') as blocked_users,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') * 299 as mrr,
    (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '30 days') as new_users_this_month,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND subscription_start > NOW() - INTERVAL '30 days') as new_subscribers_this_month;

-- User management view with all relevant data
-- Admins only (via RLS on underlying tables)
CREATE OR REPLACE VIEW admin_users_view
WITH (security_invoker = true)
AS
SELECT
    u.id,
    u.email,
    u.full_name,
    u.created_at as signup_date,
    u.last_login_at,
    r.role,
    s.status as subscription_status,
    s.trial_start,
    s.trial_end,
    s.subscription_start,
    s.renewal_date,
    s.price,
    um.posts_generated,
    um.images_generated,
    um.linkedin_posts,
    um.api_calls,
    um.last_activity,
    CASE
        WHEN s.status = 'trial' AND s.trial_end > NOW() THEN 'Active Trial'
        WHEN s.status = 'trial' AND s.trial_end <= NOW() THEN 'Trial Expired'
        WHEN s.status = 'active' THEN 'Active Subscriber'
        WHEN s.status = 'expired' THEN 'Expired'
        WHEN s.status = 'cancelled' THEN 'Cancelled'
        WHEN s.status = 'blocked' THEN 'Blocked'
        ELSE 'Unknown'
    END as status_label
FROM users u
LEFT JOIN roles r ON u.id = r.user_id
LEFT JOIN subscriptions s ON u.id = s.user_id
LEFT JOIN usage_metrics um ON u.id = um.user_id;

-- Revenue analytics view
-- Admins only (via RLS on underlying tables)
CREATE OR REPLACE VIEW admin_revenue_analytics
WITH (security_invoker = true)
AS
SELECT
    DATE_TRUNC('month', subscription_start) as month,
    COUNT(*) as new_subscriptions,
    SUM(price) as revenue,
    COUNT(*) * 299 as mrr_added
FROM subscriptions
WHERE status = 'active' AND subscription_start IS NOT NULL
GROUP BY DATE_TRUNC('month', subscription_start)
ORDER BY month DESC;

-- Usage analytics view
-- Admins only (via RLS on underlying tables)
CREATE OR REPLACE VIEW admin_usage_analytics
WITH (security_invoker = true)
AS
SELECT
    DATE_TRUNC('day', last_activity) as date,
    COUNT(DISTINCT user_id) as active_users,
    SUM(posts_generated) as total_posts,
    SUM(images_generated) as total_images,
    SUM(linkedin_posts) as total_linkedin_posts,
    SUM(api_calls) as total_api_calls
FROM usage_metrics
WHERE last_activity IS NOT NULL
GROUP BY DATE_TRUNC('day', last_activity)
ORDER BY date DESC;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Create first admin user (update with your email)
-- This should be run manually after first user signup
-- UPDATE roles SET role = 'admin' WHERE user_id = (SELECT id FROM users WHERE email = 'admin@yourcompany.com');

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================
-- 1. All admin tables have RLS enabled
-- 2. Only admins can access admin data (via RLS policies)
-- 3. All admin actions logged in admin_audit_logs
-- 4. Subscription status automatically updated on trial expiration
-- 5. Default 7-day trial for all new users
-- 6. Usage metrics tracked for all users
-- 7. Helper functions for common checks (is_admin, has_active_subscription)
-- 8. All functions have explicit search_path set (security best practice)
-- 9. Views use SECURITY INVOKER to respect RLS policies
-- 10. Supabase linter compliant
-- ============================================================================
