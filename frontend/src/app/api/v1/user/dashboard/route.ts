import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Mock dashboard data for demonstration
        const mockData = {
            subscription: {
                status: 'trial',
                trial_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                renewal_date: null
            },
            usage: {
                posts_generated: 14,
                linkedin_posts: 5
            },
            schedule: {
                is_active: true,
                days_of_week: ['Monday', 'Wednesday', 'Friday'],
                time_of_day: '09:00:00'
            },
            next_post: {
                scheduled_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                topic: 'The future of remote work and asynchronous communication.'
            },
            recent_posts: []
        };

        return NextResponse.json(mockData);
    } catch (error: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
