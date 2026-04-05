import { NextResponse } from 'next/server';

const ALLOWED_FETCH_SITES = new Set(['same-origin', 'same-site', 'none']);

export function ensureSameOrigin(request: Request): NextResponse | null {
    const requestUrl = new URL(request.url);
    const requestOrigin = requestUrl.origin;

    const origin = request.headers.get('origin');
    if (origin && origin !== requestOrigin) {
        return NextResponse.json({ error: 'Cross-site requests are not allowed' }, { status: 403 });
    }

    const referer = request.headers.get('referer');
    if (!origin && referer) {
        try {
            if (new URL(referer).origin !== requestOrigin) {
                return NextResponse.json({ error: 'Cross-site requests are not allowed' }, { status: 403 });
            }
        } catch {
            return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
        }
    }

    const secFetchSite = request.headers.get('sec-fetch-site');
    if (secFetchSite && !ALLOWED_FETCH_SITES.has(secFetchSite)) {
        return NextResponse.json({ error: 'Cross-site requests are not allowed' }, { status: 403 });
    }

    return null;
}
