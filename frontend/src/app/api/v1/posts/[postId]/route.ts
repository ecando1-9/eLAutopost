export const dynamic = 'force-dynamic';
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

async function getSessionOrUnauthorized() {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export async function GET(_request: Request, { params }: RouteParams) {
    try {
        const session = await getSessionOrUnauthorized();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const response = await fetch(
            `${BACKEND_URL}/posts/${params.postId}?user_id=${session.user.id}`,
            {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: 'no-store',
            }
        );

        const text = await response.text();
        return new NextResponse(text, {
            status: response.status,
            headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
        });
    } catch (error: any) {
        console.error('Error fetching post:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const session = await getSessionOrUnauthorized();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const response = await fetch(
            `${BACKEND_URL}/posts/${params.postId}?user_id=${session.user.id}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
            }
        );

        const text = await response.text();
        return new NextResponse(text, {
            status: response.status,
            headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
        });
    } catch (error: any) {
        console.error('Error updating post:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
    try {
        const session = await getSessionOrUnauthorized();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const response = await fetch(
            `${BACKEND_URL}/posts/${params.postId}?user_id=${session.user.id}`,
            {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
            }
        );

        if (response.status === 204) {
            return new NextResponse(null, { status: 204 });
        }

        const text = await response.text();
        return new NextResponse(text, {
            status: response.status,
            headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
        });
    } catch (error: any) {
        console.error('Error deleting post:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
