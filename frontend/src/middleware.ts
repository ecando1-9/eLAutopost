import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    const res = NextResponse.next();
    const supabase = createMiddlewareClient({ req, res });

    // Refresh session if expired
    const { data: { session } } = await supabase.auth.getSession();
    const pathname = req.nextUrl.pathname;

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/signup', '/admin/login', '/auth', '/'];
    const isPublicRoute = publicRoutes.some(route => {
        // Exact match for root
        if (route === '/' && pathname === '/') return true;
        // Starts with match for others (but exclude root from startsWith to avoid matching everything)
        if (route !== '/' && pathname.startsWith(route)) return true;
        return false;
    });

    // If not authenticated and trying to access protected route
    if (!session && !isPublicRoute) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = pathname.startsWith('/admin') ? '/admin/login' : '/login';
        return NextResponse.redirect(redirectUrl);
    }

    // If authenticated and trying to access login/public pages, redirect to dashboard
    if (session && isPublicRoute && !pathname.startsWith('/auth')) {
        const redirectUrl = req.nextUrl.clone();
        if (pathname.startsWith('/admin/login')) {
            redirectUrl.pathname = '/admin/dashboard';
            return NextResponse.redirect(redirectUrl);
        }
        redirectUrl.pathname = '/dashboard';
        return NextResponse.redirect(redirectUrl);
    }

    // Protect admin routes - require authenticated session.
    // Role validation is handled in AdminGuard via backend /admin/me.
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
        if (!session) {
            // Not logged in - redirect to admin login
            const redirectUrl = req.nextUrl.clone();
            redirectUrl.pathname = '/admin/login';
            return NextResponse.redirect(redirectUrl);
        }
    }

    // Handle /admin root path - redirect to login or dashboard
    if (pathname === '/admin' || pathname === '/admin/') {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = session ? '/admin/dashboard' : '/admin/login';
        return NextResponse.redirect(redirectUrl);
    }

    // Protect user routes - require authentication
    const userRoutes = ['/dashboard', '/content', '/posts', '/settings', '/calendar'];
    const isUserRoute = userRoutes.some(route => pathname.startsWith(route));

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
