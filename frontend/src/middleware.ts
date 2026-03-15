import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    const res = NextResponse.next();
    const supabase = createMiddlewareClient({ req, res });

    // Refresh session if expired
    const { data: { session } } = await supabase.auth.getSession();

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/signup', '/admin/login', '/auth', '/'];
    const isPublicRoute = publicRoutes.some(route => {
        // Exact match for root
        if (route === '/' && req.nextUrl.pathname === '/') return true;
        // Starts with match for others (but exclude root from startsWith to avoid matching everything)
        if (route !== '/' && req.nextUrl.pathname.startsWith(route)) return true;
        return false;
    });

    // If not authenticated and trying to access protected route
    if (!session && !isPublicRoute) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = '/login';
        return NextResponse.redirect(redirectUrl);
    }

    // If authenticated and trying to access login pages, redirect to dashboard
    if (session && isPublicRoute && !req.nextUrl.pathname.startsWith('/auth')) {
        const { data: roleData } = await supabase
            .from('roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();

        const redirectUrl = req.nextUrl.clone();

        if (req.nextUrl.pathname.startsWith('/admin/login')) {
            // Admin login - check if user is admin
            if (roleData?.role === 'admin') {
                redirectUrl.pathname = '/admin/dashboard';
                return NextResponse.redirect(redirectUrl);
            } else {
                // Not an admin, redirect to regular login
                redirectUrl.pathname = '/login';
                return NextResponse.redirect(redirectUrl);
            }
        } else {
            // Regular login - redirect based on role
            redirectUrl.pathname = roleData?.role === 'admin' ? '/admin/dashboard' : '/dashboard';
            return NextResponse.redirect(redirectUrl);
        }
    }

    // Protect admin routes - verify admin role
    if (req.nextUrl.pathname.startsWith('/admin') && !req.nextUrl.pathname.startsWith('/admin/login')) {
        if (!session) {
            // Not logged in - redirect to admin login
            const redirectUrl = req.nextUrl.clone();
            redirectUrl.pathname = '/admin/login';
            return NextResponse.redirect(redirectUrl);
        }

        // Check if user has admin role
        const { data: roleData } = await supabase
            .from('roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (roleData?.role !== 'admin') {
            // Not an admin - redirect to user dashboard with error
            const redirectUrl = req.nextUrl.clone();
            redirectUrl.pathname = '/dashboard';
            redirectUrl.searchParams.set('error', 'unauthorized');
            return NextResponse.redirect(redirectUrl);
        }
    }

    // Handle /admin root path - redirect to login or dashboard
    if (req.nextUrl.pathname === '/admin' || req.nextUrl.pathname === '/admin/') {
        const redirectUrl = req.nextUrl.clone();

        if (!session) {
            // Not logged in - show admin login
            redirectUrl.pathname = '/admin/login';
        } else {
            // Logged in - check if admin
            const { data: roleData } = await supabase
                .from('roles')
                .select('role')
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (roleData?.role === 'admin') {
                // Is admin - go to dashboard
                redirectUrl.pathname = '/admin/dashboard';
            } else {
                // Not admin - go to login
                redirectUrl.pathname = '/admin/login';
            }
        }

        return NextResponse.redirect(redirectUrl);
    }

    // Protect user routes - require authentication
    const userRoutes = ['/dashboard', '/content', '/posts', '/settings'];
    const isUserRoute = userRoutes.some(route => req.nextUrl.pathname.startsWith(route));

    if (isUserRoute && !session) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = '/login';
        return NextResponse.redirect(redirectUrl);
    }

    return res;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
