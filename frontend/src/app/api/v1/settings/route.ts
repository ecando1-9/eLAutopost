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
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const response = await fetch(`${BACKEND_URL}/settings?user_id=${session.user.id}`, {
            headers: {
                Authorization: `Bearer ${session.access_token}`,
            },
            cache: 'no-store',
        });

        const text = await response.text();
        return new NextResponse(text, {
            status: response.status,
            headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
        });
    } catch (error: any) {
        console.error('Error fetching settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const response = await fetch(`${BACKEND_URL}/settings?user_id=${session.user.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(body),
        });

        const text = await response.text();
        return new NextResponse(text, {
            status: response.status,
            headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
        });
    } catch (error: any) {
        console.error('Error updating settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
