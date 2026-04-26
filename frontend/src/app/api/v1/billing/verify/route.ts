export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ensureSameOrigin } from '@/app/api/_lib/security';

const RAW_BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').trim();
const BACKEND_URL = RAW_BACKEND_URL.endsWith('/api/v1')
    ? RAW_BACKEND_URL
    : `${RAW_BACKEND_URL.replace(/\/$/, '')}/api/v1`;

export async function POST(request: Request) {
    try {
        const sameOriginError = ensureSameOrigin(request);
        if (sameOriginError) {
            return sameOriginError;
        }

        const supabase = createRouteHandlerClient({ cookies });
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const response = await fetch(`${BACKEND_URL}/billing/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(body),
        });

        const text = await response.text();
        return new NextResponse(text, {
            status: response.status,
            headers: {
                'Content-Type': response.headers.get('content-type') || 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            },
        });
    } catch (error) {
        console.error('Error verifying Razorpay payment:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
