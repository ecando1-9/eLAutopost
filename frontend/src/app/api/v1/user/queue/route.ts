export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const RAW_BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').trim();
const BACKEND_URL = RAW_BACKEND_URL.endsWith('/api/v1')
    ? RAW_BACKEND_URL
    : `${RAW_BACKEND_URL.replace(/\/$/, '')}/api/v1`;

export async function GET(request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const statusFilter = url.searchParams.get('status_filter');
        const backendUrl = new URL(`${BACKEND_URL}/user/queue`);

        if (statusFilter) {
            backendUrl.searchParams.set('status_filter', statusFilter);
        }

        const response = await fetch(backendUrl.toString(), {
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: 'Failed to fetch queue', details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error loading queue:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
