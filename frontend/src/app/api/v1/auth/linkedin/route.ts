import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const RAW_BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const BACKEND_URL = RAW_BACKEND_URL.endsWith('/api/v1')
    ? RAW_BACKEND_URL
    : `${RAW_BACKEND_URL.replace(/\/$/, '')}/api/v1`;

export async function GET(_request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const redirectUrl = `${BACKEND_URL}/auth/linkedin?user_id=${session.user.id}`;
        return NextResponse.redirect(redirectUrl);
    } catch (error: any) {
        console.error('Error redirecting to LinkedIn auth:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
