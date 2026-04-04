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
    Sparkles,
    Heart,
    MessageSquare,
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
    likes_count?: number;
    comments_count?: number;
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
    const [settingsMeta, setSettingsMeta] = useState<any>(null);
    const [scheduleMeta, setScheduleMeta] = useState<any>(null);
    
    // Internal state for custom manual generation
    const [generatingSlot, setGeneratingSlot] = useState<string | null>(null);
    const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});

    useEffect(() => {
        const loadQueue = async () => {
            setLoading(true);
            try {
                const { data } = await supabase.auth.getSession();
                const token = data.session?.access_token;
                const [queueRes, settingsRes, scheduleRes] = await Promise.all([
                    fetch('/api/v1/user/queue', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
                    fetch('/api/v1/settings', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
                    fetch('/api/v1/user/schedule', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
                ]);

                if (queueRes.ok) {
                    const payload = await queueRes.json();
                    setPosts(payload.posts || []);
                }
                
                if (settingsRes.ok) {
                    const settings = await settingsRes.json();
                    setSettingsMeta(settings);
                }

                if (scheduleRes.ok) {
                    const payload = await scheduleRes.json();
                    setScheduleMeta(payload.schedule || null);
                }
            } catch (error) {
                console.error('Failed to load calendar data:', error);
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

    const timelineSlots = useMemo(() => {
        if (!scheduleMeta || !settingsMeta) return [];
        const postsPerDay = Math.min(5, Math.max(1, settingsMeta.max_posts_per_day || 1));
        const rawTimeStr = typeof scheduleMeta.time_of_day === 'string' ? scheduleMeta.time_of_day : '09:00';
        let builtSlots: string[] = rawTimeStr.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (builtSlots.length === 0) builtSlots = ['09:00'];
        
        // Extend or shrink to match maxPostsPerDay
        for (let i = builtSlots.length; i < postsPerDay; i++) {
            const [hh, mm] = (builtSlots[i - 1] || '09:00').split(':').map(Number);
            const nextH = ((hh + 3) % 24).toString().padStart(2, '0');
            builtSlots.push(`${nextH}:${mm.toString().padStart(2, '0')}`);
        }
        builtSlots = builtSlots.slice(0, postsPerDay);
        
        const usedPosts = new Set<string>();
        
        return builtSlots.map((slotTime: string, idx: number) => {
            const [hh, mm] = slotTime.split(':').map(Number);
            const targetMin = hh * 60 + mm;
            
            let closestPost: QueuePost | undefined;
            let closestDiff = Infinity;

            for (const post of selectedDayPosts) {
                if (!post.scheduled_at || usedPosts.has(post.id)) continue;
                const pt = new Date(post.scheduled_at);
                const postMin = pt.getHours() * 60 + pt.getMinutes();
                const diff = Math.abs(postMin - targetMin);
                if (diff < 90 && diff < closestDiff) { // Within 1.5 hours
                    closestDiff = diff;
                    closestPost = post;
                }
            }
            
            if (closestPost) {
                usedPosts.add(closestPost.id);
            }
            
            return {
                slotTime,
                index: idx,
                existingPost: closestPost
            };
        });
    }, [scheduleMeta, settingsMeta, selectedDay, selectedDayPosts]);

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

                            {scheduleMeta?.is_active && timelineSlots.length > 0 && selectedDayPosts.length === 0 && (
                                <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 flex items-start gap-2">
                                    <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    Auto-post is enabled for these slots. If you just saved Settings, scheduled posts can take a short moment to appear while the generator prepares content.
                                </div>
                            )}

                            {/* Engagement Summary for Post-Only Days */}
                            {selectedDayPosts.some(p => p.status === 'posted') && (
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                                        <div className="flex items-center gap-2 text-sky-700 mb-1">
                                            <Heart className="h-4 w-4" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Total Likes</span>
                                        </div>
                                        <p className="text-2xl font-bold text-slate-900">
                                            {selectedDayPosts.reduce((sum, p) => sum + (p.likes_count || 0), 0)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                                        <div className="flex items-center gap-2 text-indigo-700 mb-1">
                                            <MessageSquare className="h-4 w-4" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Total Comments</span>
                                        </div>
                                        <p className="text-2xl font-bold text-slate-900">
                                            {selectedDayPosts.reduce((sum, p) => sum + (p.comments_count || 0), 0)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                {selectedDayPosts.length === 0 && timelineSlots.length === 0 ? (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800 text-sm flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 mt-0.5" />
                                        Your auto-generation schedule is not active for this specific day. Update your schedule in Settings.
                                    </div>
                                ) : (
                                    <>
                                        {/* 1. Show all ACTUAL posts for the day from the DB */}
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
                                                            {post.caption || 'This post is queued up for execution.'}
                                                        </p>
                                                    </div>
                                                    
                                                    <div className="flex flex-col items-end gap-2 mt-2 sm:mt-0">
                                                        {post.status === 'posted' ? (
                                                            <div className="flex flex-col items-end gap-1.5">
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                                                                    <Sparkles className="h-3 w-3" /> Published
                                                                </span>
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    <div className="flex items-center gap-1 text-slate-600">
                                                                        <Heart className="h-3.5 w-3.5 text-pink-500 fill-pink-500" />
                                                                        <span className="text-sm font-bold">{post.likes_count || 0}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-slate-600">
                                                                        <MessageSquare className="h-3.5 w-3.5 text-sky-500 fill-sky-500" />
                                                                        <span className="text-sm font-bold">{post.comments_count || 0}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                                                                    <CheckCircle2 className="h-3 w-3" /> Scheduled
                                                                </span>
                                                                <button
                                                                    onClick={() => router.push('/posts')}
                                                                    className="inline-flex items-center gap-1.5 rounded-lg text-xs font-bold text-sky-700 hover:text-sky-900 transition-colors px-1"
                                                                >
                                                                    Review in Queue →
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* 2. Show Empty Slots only if under capacity */}
                                        {Array.from({ length: Math.max(0, (timelineSlots.length || 0) - selectedDayPosts.length) }).map((_, i) => {
                                            const slotIdx = selectedDayPosts.length + i;
                                            const slotTime = timelineSlots[slotIdx]?.slotTime || '12:00';
                                            const pKey = `${selectedDay}-empty-${slotIdx}`;
                                            return (
                                                <div key={`empty-${slotIdx}`} className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 transition-colors focus-within:border-sky-400 focus-within:bg-sky-50/50">
                                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                                        <div className="flex-1 w-full">
                                                            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                                                                <div className="flex items-center gap-1 text-slate-500 bg-slate-200/50 px-2.5 py-1 rounded-md">
                                                                    <Clock3 className="h-3.5 w-3.5" />
                                                                    {(() => {
                                                                        const [hh, mm] = slotTime.split(':').map(Number);
                                                                        const hour12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
                                                                        const ampm = hh >= 12 ? 'PM' : 'AM';
                                                                        return `${hour12}:${mm.toString().padStart(2, '0')} ${ampm}`;
                                                                    })()}
                                                                </div>
                                                                <span className="px-2.5 py-1 rounded-md bg-transparent text-slate-400 border border-slate-200">
                                                                    Available Slot
                                                                </span>
                                                            </div>
                                                            <div className="mt-3 flex flex-col gap-3">
                                                                <label className="text-sm font-semibold text-slate-700">Need something specific for this slot?</label>
                                                                <div className="flex flex-col sm:flex-row gap-2 w-full">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="e.g. 'Top basic commands for Linux new users'"
                                                                        value={customPrompts[pKey] || ''}
                                                                        onChange={(e) => setCustomPrompts({ ...customPrompts, [pKey]: e.target.value })}
                                                                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-400"
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' && customPrompts[pKey]?.trim()) {
                                                                                e.preventDefault();
                                                                                router.push(`/content/create?scheduleDate=${selectedDay}&scheduleTime=${slotTime}&topic=${encodeURIComponent(customPrompts[pKey].trim())}`);
                                                                            }
                                                                        }}
                                                                    />
                                                                    <button
                                                                        disabled={!customPrompts[pKey]?.trim()}
                                                                        onClick={() => {
                                                                            router.push(`/content/create?scheduleDate=${selectedDay}&scheduleTime=${slotTime}&topic=${encodeURIComponent(customPrompts[pKey].trim())}`);
                                                                        }}
                                                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-500 disabled:bg-slate-300 disabled:cursor-not-allowed"
                                                                    >
                                                                        <Sparkles className="h-4 w-4" />
                                                                        Generate
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AppShell>
    );
}
