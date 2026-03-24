import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const RAW_BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').trim();
const BACKEND_URL = RAW_BACKEND_URL.endsWith('/api/v1')
    ? RAW_BACKEND_URL
    : `${RAW_BACKEND_URL.replace(/\/$/, '')}/api/v1`;

type RouteParams = {
    params: {
        postId: string;
    };
};

export async function POST(request: Request, { params }: RouteParams) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const target = typeof body.target === 'string' ? body.target : 'person';
        const organizationId = typeof body.organization_id === 'string' ? body.organization_id : '';

        const backendUrl = new URL(`${BACKEND_URL}/posts/${params.postId}/publish`);
        backendUrl.searchParams.set('user_id', session.user.id);
        backendUrl.searchParams.set('target', target);
        if (organizationId) {
            backendUrl.searchParams.set('organization_id', organizationId);
        }

        const response = await fetch(backendUrl.toString(), {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.access_token}`,
            },
        });

        const text = await response.text();
        return new NextResponse(text, {
            status: response.status,
            headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
        });
    } catch (error: any) {
        console.error('Error publishing post:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
