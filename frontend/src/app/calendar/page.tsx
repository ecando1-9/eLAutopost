'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    CalendarDays,
    Loader2,
    CheckCircle2,
    Clock3,
    Plus,
    AlertCircle,
    Send,
} from 'lucide-react';
import AppShell from '@/components/AppShell';

interface QueuePost {
    id: string;
    topic: string;
    hook: string;
    caption: string;
    status: 'draft' | 'scheduled' | 'posted' | 'failed';
    scheduled_at?: string;
    posted_at?: string;
    target?: 'person' | 'organization';
    organization_id?: string;
}

function toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDayLabel(date: Date): string {
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function parseDateKeyToLocal(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map((value) => parseInt(value, 10));
    return new Date(year, month - 1, day);
}

export default function ContentCalendarPage() {
    const router = useRouter();
    const supabase = createClientComponentClient();

    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<QueuePost[]>([]);
    const [selectedDay, setSelectedDay] = useState<string>(toDateKey(new Date()));

    useEffect(() => {
        const loadQueue = async () => {
            setLoading(true);
            try {
                const { data } = await supabase.auth.getSession();
                const token = data.session?.access_token;
                const response = await fetch('/api/v1/user/queue', {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: 'no-store',
                });

                if (!response.ok) {
                    throw new Error('Failed to load queue');
                }

                const payload = await response.json();
                setPosts(payload.posts || []);
            } catch (error) {
                console.error('Failed to load calendar queue:', error);
                setPosts([]);
            } finally {
                setLoading(false);
            }
        };

        loadQueue();
    }, []);

    const upcomingDays = useMemo(() => {
        return Array.from({ length: 14 }).map((_, index) => {
            const date = new Date();
            date.setDate(date.getDate() + index);
            return date;
        });
    }, []);

    const scheduledPosts = useMemo(() => {
        return posts
            .filter((post) => post.status === 'scheduled' && post.scheduled_at)
            .sort((a, b) => {
                const aTime = new Date(a.scheduled_at || '').getTime();
                const bTime = new Date(b.scheduled_at || '').getTime();
                return aTime - bTime;
            });
    }, [posts]);

    const selectedDayPosts = useMemo(() => {
        return scheduledPosts.filter((post) => {
            if (!post.scheduled_at) return false;
            return toDateKey(new Date(post.scheduled_at)) === selectedDay;
        });
    }, [scheduledPosts, selectedDay]);

    const draftCount = posts.filter((post) => post.status === 'draft').length;

    return (
        <AppShell
            title="Posting Calendar"
            description="View day-by-day publishing workload and schedule missing posts."
            action={
                <button
                    onClick={() => router.push(`/content/create?scheduleDate=${selectedDay}`)}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                    <Plus className="h-4 w-4" />
                    Generate for Selected Day
                </button>
            }
        >
            <div>
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
                    </div>
                ) : (
                    <>
                        <div className="grid sm:grid-cols-3 gap-4 mb-6">
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Scheduled</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">{scheduledPosts.length}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Draft Queue</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">{draftCount}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Selected Day</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">{selectedDayPosts.length}</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
                            <div className="flex items-center gap-2 mb-4 text-slate-700">
                                <CalendarDays className="h-4 w-4" />
                                <span className="text-sm font-semibold">Choose a day</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                                {upcomingDays.map((day) => {
                                    const key = toDateKey(day);
                                    const count = scheduledPosts.filter((post) => post.scheduled_at && toDateKey(new Date(post.scheduled_at)) === key).length;
                                    const selected = key === selectedDay;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setSelectedDay(key)}
                                            className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                                                selected
                                                    ? 'border-slate-900 bg-slate-900 text-white'
                                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            <p className="text-xs font-semibold">{formatDayLabel(day)}</p>
                                            <p className={`text-xs mt-1 ${selected ? 'text-slate-200' : 'text-slate-500'}`}>
                                                {count} scheduled
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-slate-900">
                                    Tasks for {parseDateKeyToLocal(selectedDay).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                                </h2>
                                <button
                                    onClick={() => router.push(`/content/create?scheduleDate=${selectedDay}`)}
                                    className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                                >
                                    + Add Post
                                </button>
                            </div>

                            {selectedDayPosts.length === 0 ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800 text-sm flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 mt-0.5" />
                                    No scheduled post for this day. Generate content now and schedule it.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {selectedDayPosts.map((post) => (
                                        <div key={post.id} className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                                                        <div className="flex items-center gap-1 text-sky-600 bg-sky-50 px-2.5 py-1 rounded-md">
                                                            <Clock3 className="h-3.5 w-3.5" />
                                                            {post.scheduled_at
                                                                ? new Date(post.scheduled_at).toLocaleTimeString(undefined, {
                                                                      hour: '2-digit',
                                                                      minute: '2-digit',
                                                                  })
                                                                : 'Time not set'}
                                                        </div>
                                                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                                            {post.topic || 'General Post'}
                                                        </span>
                                                    </div>
                                                    
                                                    <h3 className="text-base font-bold text-slate-900 line-clamp-1">
                                                        {post.hook || 'Content automatically generating...'}
                                                    </h3>
                                                    
                                                    <p className="mt-1.5 text-sm text-slate-500 line-clamp-2 max-w-2xl">
                                                        {post.caption || 'This post is queued up for execution and the AI will finalize its payload before posting.'}
                                                    </p>
                                                </div>
                                                
                                                <div className="flex flex-col items-end gap-2 mt-2 sm:mt-0">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                                                        <CheckCircle2 className="h-3 w-3" /> Scheduled
                                                    </span>
                                                    <button
                                                        onClick={() => router.push('/posts')}
                                                        className="inline-flex items-center gap-1.5 rounded-lg text-xs font-bold text-sky-700 hover:text-sky-900 transition-colors px-1"
                                                    >
                                                        Review in Queue →
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </AppShell>
    );
}
