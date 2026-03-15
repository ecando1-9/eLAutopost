import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export async function POST(request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        const response = await fetch(`${BACKEND_URL}/content/generate/carousel?user_id=${session.user.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend PDF Error:', errorText);
            return NextResponse.json({ error: 'Failed to generate PDF' }, { status: response.status });
        }

        // Return PDF blob
        const pdfBlob = await response.blob();
        return new NextResponse(pdfBlob, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="carousel.pdf"'
            }
        });
        
    } catch (error: any) {
        console.error('API Route Error generating PDF:', error);
        return NextResponse.json(
            { error: 'Internal server error while generating PDF.' },
            { status: 500 }
        );
    }
}
