export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const RAW_BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').trim();
const BACKEND_URL = RAW_BACKEND_URL.endsWith('/api/v1')
    ? RAW_BACKEND_URL
    : `${RAW_BACKEND_URL.replace(/\/$/, '')}/api/v1`;

export async function GET(_request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.redirect(new URL('/login', _request.url));
        }

        const response = await fetch(`${BACKEND_URL}/auth/linkedin`, {
            headers: {
                Authorization: `Bearer ${session.access_token}`,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LinkedIn auth bootstrap failed:', errorText);
            return NextResponse.redirect(new URL('/settings?linkedin=error', _request.url));
        }

        const payload = await response.json();
        if (!payload?.authorization_url || typeof payload.authorization_url !== 'string') {
            console.error('LinkedIn auth bootstrap returned invalid payload');
            return NextResponse.redirect(new URL('/settings?linkedin=error', _request.url));
        }

        return NextResponse.redirect(payload.authorization_url);
    } catch (error: any) {
        console.error('Error redirecting to LinkedIn auth:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
