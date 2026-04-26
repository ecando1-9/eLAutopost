export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ensureSameOrigin } from '@/app/api/_lib/security';

const RAW_BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').trim();
const BACKEND_URL = RAW_BACKEND_URL.endsWith('/api/v1')
    ? RAW_BACKEND_URL
    : `${RAW_BACKEND_URL.replace(/\/$/, '')}/api/v1`;

type RouteContext = {
    params: {
        path: string[];
    };
};

async function proxyAdminRequest(request: Request, context: RouteContext) {
    try {
        if (!['GET', 'HEAD'].includes(request.method)) {
            const sameOriginError = ensureSameOrigin(request);
            if (sameOriginError) {
                return sameOriginError;
            }
        }

        const supabase = createRouteHandlerClient({ cookies });
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const incomingUrl = new URL(request.url);
        const backendUrl = new URL(
            `${BACKEND_URL}/admin/${context.params.path.join('/')}`
        );

        incomingUrl.searchParams.forEach((value, key) => {
            backendUrl.searchParams.append(key, value);
        });

        const headers: HeadersInit = {
            Authorization: `Bearer ${session.access_token}`,
        };

        const contentType = request.headers.get('content-type');
        if (contentType) {
            headers['Content-Type'] = contentType;
        }

        const accept = request.headers.get('accept');
        if (accept) {
            headers.Accept = accept;
        }

        const response = await fetch(backendUrl.toString(), {
            method: request.method,
            headers,
            body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
            cache: 'no-store',
        });

        const body = await response.text();
        return new NextResponse(body, {
            status: response.status,
            headers: {
                'Content-Type': response.headers.get('content-type') || 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            },
        });
    } catch (error: any) {
        console.error('Error proxying admin request:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(request: Request, context: RouteContext) {
    return proxyAdminRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
    return proxyAdminRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
    return proxyAdminRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
    return proxyAdminRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
    return proxyAdminRequest(request, context);
}
