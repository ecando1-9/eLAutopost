-- EMERGENCY FIX FOR ADMIN ACCESS
-- The issue is likely "Row Level Security" (RLS) blocking the app from reading the 'roles' table.
-- Even if you are an admin, if the app can't READ the role, it denies access.
-- This script fixes the permissions and ensures you are an admin.

BEGIN;

-- 1. Grant general permissions ensuring the app can read tables
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. FIX PERMISSIONS (RLS) ON ROLES TABLE
-- This is critical: without this, "SELECT * FROM roles" returns empty for users
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Reset policies
DROP POLICY IF EXISTS "Users can read own role" ON public.roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.roles;

-- Allow any logged-in user to read THEIR OWN role
CREATE POLICY "Users can read own role" 
ON public.roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow admins to read ALL roles (for the dashboard)
CREATE POLICY "Admins can read all roles" 
ON public.roles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 3. FORCE ADMIN ROLE FOR ecanconnect@gmail.com
DO $$
DECLARE
    target_email text := 'ecanconnect@gmail.com'; -- The email you are using
    target_user_id uuid;
BEGIN
    -- Find the User ID from Supabase Auth
    SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
    
    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User % NOT FOUND. Please Sign Up first.', target_email;
    ELSE
        -- Ensure user exists in public.users table
        INSERT INTO public.users (id, email, full_name, auth_provider)
        VALUES (target_user_id, target_email, 'Admin User', 'email')
        ON CONFLICT (id) DO NOTHING;

        -- Insert or Update role to ADMIN
        INSERT INTO public.roles (user_id, role)
        VALUES (target_user_id, 'admin')
        ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
        
        RAISE NOTICE 'SUCCESS: % is now an ADMIN and permissions are fixed.', target_email;
    END IF;
END $$;

-- 4. Also force for yuvakiranreddy7@gmail.com just in case
DO $$
DECLARE
    target_email text := 'yuvakiranreddy7@gmail.com';
    target_user_id uuid;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
    
    IF target_user_id IS NOT NULL THEN
        INSERT INTO public.roles (user_id, role)
        VALUES (target_user_id, 'admin')
        ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
    END IF;
END $$;

COMMIT;
