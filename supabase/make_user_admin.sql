-- Make a user admin by email
-- Update email value as needed before running.

INSERT INTO public.roles (user_id, role)
SELECT id, 'admin'
FROM public.users
WHERE lower(email) = lower('yuvakiranreddy7@gmail.com')
ON CONFLICT (user_id)
DO UPDATE SET role = 'admin', updated_at = NOW();

-- Verify:
-- SELECT u.id, u.email, r.role
-- FROM public.users u
-- JOIN public.roles r ON r.user_id = u.id
-- WHERE lower(u.email) = lower('yuvakiranreddy7@gmail.com');

