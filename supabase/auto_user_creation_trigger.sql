-- ============================================================================
-- AUTO USER CREATION TRIGGER
-- ============================================================================
-- This trigger automatically creates user records when someone signs up
-- via Supabase Auth. It ensures all related tables are populated.
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert into public.users table
    INSERT INTO public.users (id, email, full_name, auth_provider)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Create default settings
    INSERT INTO public.settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create subscription with 7-day trial
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
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create default role (user)
    INSERT INTO public.roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create usage metrics
    INSERT INTO public.usage_metrics (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- Allow the trigger function to be executed
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;

-- ============================================================================
-- TEST THE TRIGGER (Optional - comment out after testing)
-- ============================================================================
-- To test, create a test user in Supabase Auth Dashboard
-- Then check if records were created in all tables
