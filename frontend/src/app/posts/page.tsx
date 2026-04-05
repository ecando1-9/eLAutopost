'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    Calendar,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    ExternalLink,
    AlertCircle,
    Search,
    Heart,
    MessageSquare,
    Filter,
    Trash2,
    Send,
    Eye,
    Pencil,
    Sparkles,
    X,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import LinkedInPreview from '@/components/LinkedInPreview';

interface Post {
    id: string;
    topic: string;
    hook: string;
    caption: string;
    image_prompt: string;
    image_url?: string;
    status: 'draft' | 'pending_review' | 'scheduled' | 'running' | 'posted' | 'failed';
    scheduled_at?: string;
    posted_at?: string;
    linkedin_url?: string;
    error_message?: string;
    target?: 'person' | 'organization';
    organization_id?: string;
    created_at: string;
    likes_count?: number;
    comments_count?: number;
}

const QUEUE_STATUSES = ['draft', 'pending_review', 'scheduled', 'running'] as const;
const EDITABLE_STATUSES = ['draft', 'pending_review', 'scheduled', 'failed'] as const;

type QueueFilter =
    | 'all'
    | 'queue'
    | 'posted'
    | 'scheduled'
    | 'pending_review'
    | 'draft'
    | 'running'
    | 'failed';

function formatStatusLabel(status: QueueFilter): string {
    if (status === 'all') return 'All';
    if (status === 'queue') return 'Queue';
    return status
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatPostStatusLabel(status: Post['status']): string {
    return status
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function toLocalDateTimeInput(value?: string): string {
    const base = value ? new Date(value) : new Date();
    if (Number.isNaN(base.getTime())) {
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 1);
        fallback.setHours(9, 0, 0, 0);
        const fallbackOffset = fallback.getTimezoneOffset() * 60000;
        return new Date(fallback.getTime() - fallbackOffset).toISOString().slice(0, 16);
    }

    const tzOffsetMs = base.getTimezoneOffset() * 60000;
    return new Date(base.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function buildDefaultScheduleInput(): string {
    const base = new Date();
    base.setDate(base.getDate() + 1);
    base.setHours(9, 0, 0, 0);
    return toLocalDateTimeInput(base.toISOString());
}

function canReviewPost(post: Post): boolean {
    return EDITABLE_STATUSES.includes(post.status as (typeof EDITABLE_STATUSES)[number]);
}

function canSchedulePost(post: Post): boolean {
    return post.status !== 'posted' && post.status !== 'running';
}

function canPublishPost(post: Post): boolean {
    return post.status !== 'posted' && post.status !== 'running';
}

function getScheduleButtonLabel(post: Post): string {
    if (post.status === 'scheduled') return 'Change Time';
    if (post.status === 'pending_review') return 'Approve & Schedule';
    return 'Schedule';
}

export default function PostsPage() {
    const router = useRouter();
    const supabase = createClientComponentClient();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<QueueFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'generated' | 'scheduled'>('generated');
    const [actionPostId, setActionPostId] = useState<string | null>(null);
    const [previewPost, setPreviewPost] = useState<Post | null>(null);
    const [editModal, setEditModal] = useState<Post | null>(null);
    const [scheduleModal, setScheduleModal] = useState<Post | null>(null);
    const [scheduleDate, setScheduleDate] = useState(buildDefaultScheduleInput);
    const [editTopic, setEditTopic] = useState('');
    const [editHook, setEditHook] = useState('');
    const [editCaption, setEditCaption] = useState('');
    const [aiRewritePrompt, setAiRewritePrompt] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [rewritingPostId, setRewritingPostId] = useState<string | null>(null);

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            // Fetch everything, filter in frontend for snappiness
            const url = '/api/v1/user/queue';

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setPosts(data.posts || []);
            }
        } catch (error) {
            console.error('Failed to fetch posts:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPosts = useMemo(() => {
        let result = [...posts];

        // 1. Status Filter
        if (statusFilter !== 'all') {
            result = result.filter((post) => {
                if (statusFilter === 'queue') {
                    return QUEUE_STATUSES.includes(post.status as (typeof QUEUE_STATUSES)[number]);
                }
                return post.status === statusFilter;
            });
        }

        // 2. Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p => 
                p.topic.toLowerCase().includes(q) || 
                p.hook.toLowerCase().includes(q) || 
                p.caption.toLowerCase().includes(q)
            );
        }

        // 3. Sorting (Backend already does some, but we enforce here)
        result.sort((a, b) => {
            if (sortBy === 'scheduled') {
                const dateA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
                const dateB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
                return dateA - dateB; // Soonest first
            } else {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // Latest generated first
            }
        });

        return result;
    }, [posts, statusFilter, searchQuery, sortBy]);

    const filterCounts = useMemo(() => {
        const queueCount = posts.filter((post) =>
            QUEUE_STATUSES.includes(post.status as (typeof QUEUE_STATUSES)[number])
        ).length;

        return {
            all: posts.length,
            queue: queueCount,
            posted: posts.filter((post) => post.status === 'posted').length,
            scheduled: posts.filter((post) => post.status === 'scheduled').length,
            pending_review: posts.filter((post) => post.status === 'pending_review').length,
            draft: posts.filter((post) => post.status === 'draft').length,
            running: posts.filter((post) => post.status === 'running').length,
            failed: posts.filter((post) => post.status === 'failed').length,
        } satisfies Record<QueueFilter, number>;
    }, [posts]);

    const getStatusBadge = (status: string) => {
        const styles = {
            draft: 'bg-gray-100 text-gray-800 border-gray-200',
            pending_review: 'bg-amber-100 text-amber-800 border-amber-200',
            scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
            running: 'bg-violet-100 text-violet-800 border-violet-200',
            posted: 'bg-green-100 text-green-800 border-green-200',
            failed: 'bg-red-100 text-red-800 border-red-200'
        };

        const icons = {
            draft: <Clock className="h-3 w-3" />,
            pending_review: <Eye className="h-3 w-3" />,
            scheduled: <Calendar className="h-3 w-3" />,
            running: <Loader2 className="h-3 w-3 animate-spin" />,
            posted: <CheckCircle2 className="h-3 w-3" />,
            failed: <XCircle className="h-3 w-3" />
        };

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${styles[status as keyof typeof styles] || styles.draft}`}>
                {icons[status as keyof typeof icons] || icons.draft}
                {formatPostStatusLabel(status as Post['status'])}
            </span>
        );
    };

    const runPostAction = async (
        postId: string,
        action: 'publish' | 'schedule' | 'delete',
        post?: Post,
        customScheduledAt?: string
    ) => {
        setActionPostId(postId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            let response: Response;

            if (action === 'publish') {
                response = await fetch(`/api/v1/posts/${postId}/publish`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        target: post?.target || 'person',
                        organization_id: post?.organization_id || '',
                    }),
                });
            } else if (action === 'schedule') {
                const scheduledAt = customScheduledAt
                    ? new Date(customScheduledAt).toISOString()
                    : new Date(Date.now() + 60 * 60 * 1000).toISOString();
                response = await fetch(`/api/v1/posts/${postId}/schedule`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        scheduled_at: scheduledAt,
                        target: post?.target || 'person',
                        organization_id: post?.organization_id || '',
                    }),
                });
            } else {
                response = await fetch(`/api/v1/posts/${postId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            }

            if (!response.ok) {
                let errorMsg = `Failed to ${action} post`;
                const text = await response.text().catch(() => '');
                if (text) {
                    try {
                        const errData = JSON.parse(text);
                        errorMsg = errData.detail || errData.error || errData.message || errorMsg;
                    } catch {
                        errorMsg = text;
                    }
                }
                toast.error(errorMsg);
                throw new Error(errorMsg);
            }

            if (action === 'publish') {
                // Check if result indicates failure vs success
                const result = await response.json().catch(() => ({}));
                if (result.status === 'failed') {
                    const errMsg = result.error_message || 'LinkedIn rejected the post.';
                    toast.error(`Publish failed: ${errMsg}`);
                } else {
                    const url = result.linkedin_url;
                    toast.success(
                        url
                            ? `Posted to LinkedIn! View it here.`
                            : 'Published to LinkedIn!',
                        { duration: 5000 }
                    );
                }
            } else if (action === 'schedule') {
                toast.success('Post scheduled successfully!');
            } else if (action === 'delete') {
                toast.success('Post deleted.');
            }

            await fetchPosts();
        } catch (error: any) {
            console.error(`Failed to ${action} post:`, error);
        } finally {
            setActionPostId(null);
        }
    };

    const handleScheduleSubmit = async () => {
        if (!scheduleModal) return;
        await runPostAction(scheduleModal.id, 'schedule', scheduleModal, scheduleDate);
        setScheduleModal(null);
    };

    const openScheduleModal = (post: Post) => {
        setScheduleDate(post.scheduled_at ? toLocalDateTimeInput(post.scheduled_at) : buildDefaultScheduleInput());
        setScheduleModal(post);
    };

    const openEditModal = (post: Post) => {
        setEditModal(post);
        setEditTopic(post.topic || '');
        setEditHook(post.hook || '');
        setEditCaption(post.caption || '');
        setAiRewritePrompt('');
    };

    const handleSaveManualChanges = async () => {
        if (!editModal) return;

        const trimmedTopic = editTopic.trim();
        const trimmedHook = editHook.trim();
        const trimmedCaption = editCaption.trim();

        if (!trimmedTopic || !trimmedHook || !trimmedCaption) {
            toast.error('Topic, hook, and caption are required.');
            return;
        }

        setSavingEdit(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const response = await fetch(`/api/v1/posts/${editModal.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    topic: trimmedTopic,
                    hook: trimmedHook,
                    caption: trimmedCaption,
                }),
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || 'Failed to save post changes');
            }

            toast.success('Post content updated.');
            setEditModal(null);
            await fetchPosts();
        } catch (error: any) {
            toast.error(error.message || 'Failed to save post changes');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleAiRewrite = async () => {
        if (!editModal) return;
        if (!editTopic.trim()) {
            toast.error('Add a topic before asking AI to rework this post.');
            return;
        }

        setRewritingPostId(editModal.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const response = await fetch(`/api/v1/posts/${editModal.id}/ai-rewrite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    topic: editTopic.trim(),
                    prompt: aiRewritePrompt.trim(),
                }),
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || 'Failed to rewrite post');
            }

            const updatedPost: Post = await response.json();
            setEditModal(updatedPost);
            setEditTopic(updatedPost.topic || '');
            setEditHook(updatedPost.hook || '');
            setEditCaption(updatedPost.caption || '');
            setAiRewritePrompt('');
            toast.success('AI reworked this post using your latest settings.');
            await fetchPosts();
        } catch (error: any) {
            toast.error(error.message || 'Failed to rewrite post');
        } finally {
            setRewritingPostId(null);
        }
    };

    return (
        <AppShell
            title="Content Queue"
            description="Review, schedule, publish, and clean up generated posts."
            action={
                <button
                    onClick={() => router.push('/content/create')}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                >
                    Create New Post
                </button>
            }
        >
            <div>
                {/* Schedule Modal */}
                {scheduleModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-indigo-600" />
                                    {scheduleModal.status === 'scheduled' ? 'Change Post Time' : 'Schedule Post'}
                                </h3>
                                <button onClick={() => setScheduleModal(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 mb-1 font-medium">Topic: <span className="text-gray-900">{scheduleModal.topic}</span></p>
                            <p className="text-sm text-gray-500 mb-4">Update the publish time for this specific post only.</p>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Date & Time</label>
                            <input
                                type="datetime-local"
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm mb-4"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setScheduleModal(null)}
                                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleScheduleSubmit}
                                    disabled={actionPostId === scheduleModal.id}
                                    className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {actionPostId === scheduleModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                                    Save Time
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {editModal && (
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm p-4">
                        <div className="mx-auto mt-6 w-full max-w-5xl rounded-3xl bg-white shadow-2xl">
                            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                                            <Pencil className="h-3.5 w-3.5" />
                                            Review Post
                                        </span>
                                        {getStatusBadge(editModal.status)}
                                    </div>
                                    <h3 className="mt-3 text-xl font-bold text-slate-900">Manual edit or ask AI to rework it</h3>
                                    <p className="mt-1 text-sm text-slate-600">
                                        Update the content directly, or give AI a clear instruction for this one post only.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {editModal.scheduled_at && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {format(new Date(editModal.scheduled_at), 'MMM d, yyyy HH:mm')}
                                        </span>
                                    )}
                                    {canSchedulePost(editModal) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditModal(null);
                                                openScheduleModal(editModal);
                                            }}
                                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                                        >
                                            Change Time
                                        </button>
                                    )}
                                    <button onClick={() => setEditModal(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                            Topic
                                        </label>
                                        <input
                                            type="text"
                                            value={editTopic}
                                            onChange={(e) => setEditTopic(e.target.value)}
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                                            placeholder="What is this post about?"
                                        />
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                            Hook
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={editHook}
                                            onChange={(e) => setEditHook(e.target.value)}
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                                            placeholder="Scroll-stopping opening line"
                                        />
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Caption
                                            </label>
                                            <span className="text-xs text-slate-400">{editCaption.length}/3000</span>
                                        </div>
                                        <textarea
                                            rows={12}
                                            value={editCaption}
                                            onChange={(e) => setEditCaption(e.target.value)}
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-sky-500"
                                            placeholder="Refine the post body here..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-4">
                                        <div className="flex items-center gap-2 text-violet-700">
                                            <Sparkles className="h-4 w-4" />
                                            <p className="text-sm font-semibold">AI Rework This Post</p>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">
                                            Give one clear instruction and AI will rewrite this post using the latest saved goals, audience, style, and tone from Settings.
                                        </p>
                                        <textarea
                                            rows={6}
                                            value={aiRewritePrompt}
                                            onChange={(e) => setAiRewritePrompt(e.target.value)}
                                            className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                                            placeholder="e.g. Make this sharper for students, add a stronger hook, and keep it more practical."
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAiRewrite}
                                            disabled={rewritingPostId === editModal.id}
                                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                                        >
                                            {rewritingPostId === editModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                            AI Rework & Apply
                                        </button>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-sm font-semibold text-slate-900">Review flow</p>
                                        <p className="mt-2 text-sm text-slate-600">
                                            Auto-generated posts stay short-range so you can review today&apos;s remaining slot and tomorrow&apos;s content before it publishes.
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <p className="text-sm font-semibold text-slate-900">Current target</p>
                                        <p className="mt-2 text-sm text-slate-600">
                                            {editModal.target === 'organization' ? 'LinkedIn Page' : 'LinkedIn Profile'}
                                        </p>
                                        {editModal.error_message && (
                                            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                                {editModal.error_message}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                                <button
                                    onClick={() => setEditModal(null)}
                                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveManualChanges}
                                    disabled={savingEdit}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                                >
                                    {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                    Save Manual Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* LinkedIn Preview Modal */}
                {previewPost && (
                    <LinkedInPreview
                        hook={previewPost.hook}
                        caption={previewPost.caption}
                        onClose={() => setPreviewPost(null)}
                    />
                )}

                {/* Filters & Search */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by topic or content..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none text-sm transition-all shadow-sm"
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start">
                            <button
                                onClick={() => setSortBy('generated')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${sortBy === 'generated' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Clock className="h-3.5 w-3.5" /> Generated Time
                            </button>
                            <button
                                onClick={() => setSortBy('scheduled')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${sortBy === 'scheduled' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Calendar className="h-3.5 w-3.5" /> Post Time
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <Filter className="h-4 w-4 text-slate-400 shrink-0 mr-1" />
                        <div className="flex gap-1.5">
                            {(['all', 'queue', 'posted', 'scheduled', 'pending_review', 'draft', 'running', 'failed'] as QueueFilter[]).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${statusFilter === status
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                >
                                    {formatStatusLabel(status)} ({filterCounts[status]})
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                    Auto-generated posts are kept intentionally short-range so you can review them before they publish. The queue is meant to cover any remaining slot today plus tomorrow, not a long backlog of stale content.
                </div>

                {/* Posts List */}
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : posts.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
                        <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Queue is empty</h3>
                        <p className="text-slate-500 mb-8 max-w-sm mx-auto">
                            You haven't generated any LinkedIn posts yet. Start by creating a strategy or setting up auto-generation.
                        </p>
                        <button
                            onClick={() => router.push('/content/create')}
                            className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-md active:scale-95"
                        >
                            Create First Post
                        </button>
                    </div>
                ) : filteredPosts.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
                        <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">No matching posts</h3>
                        <p className="text-slate-500 mb-8 max-w-sm mx-auto">
                            We couldn't find any posts matching your current filters or search query. 
                        </p>
                        <button
                            onClick={() => {
                                setStatusFilter('all');
                                setSearchQuery('');
                            }}
                            className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-md active:scale-95"
                        >
                            Reset All Filters
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredPosts.map(post => (
                            <div key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900">{post.topic}</h3>
                                            {getStatusBadge(post.status)}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                                                <Clock className="h-3 w-3" />
                                                Generated {format(new Date(post.created_at), 'MMM d, yyyy HH:mm')}
                                            </span>
                                            {post.scheduled_at && (
                                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                                                    <Calendar className="h-3 w-3" />
                                                    Post time {format(new Date(post.scheduled_at), 'MMM d, yyyy HH:mm')}
                                                </span>
                                            )}
                                            {post.posted_at && (
                                                <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 border border-green-200">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Posted {format(new Date(post.posted_at), 'MMM d, yyyy HH:mm')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Hook */}
                                <div className="mb-3">
                                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-3">
                                        <p className="text-lg font-bold text-gray-900 uppercase">{post.hook}</p>
                                    </div>
                                </div>

                                {/* Caption Preview */}
                                <div className="mb-4">
                                    <p className="text-gray-700 line-clamp-3">{post.caption}</p>
                                </div>

                                <div className="mb-4">
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                        Target: {post.target === 'organization' ? 'LinkedIn Page' : 'LinkedIn Profile'}
                                    </span>
                                </div>

                                {/* Error Message */}
                                {post.error_message && (
                                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                                        <p className="text-sm text-red-700">
                                            <strong>Error:</strong> {post.error_message}
                                        </p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                                    <button
                                        onClick={() => setPreviewPost(post)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                                    >
                                        <Eye className="h-4 w-4" />
                                        Preview
                                    </button>
                                    {canReviewPost(post) && (
                                        <button
                                            onClick={() => openEditModal(post)}
                                            className="flex items-center gap-2 px-4 py-2 text-sm bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors"
                                        >
                                            <Pencil className="h-4 w-4" />
                                            Review & Edit
                                        </button>
                                    )}
                                    {canPublishPost(post) && (
                                        <button
                                            onClick={() => runPostAction(post.id, 'publish', post)}
                                            disabled={actionPostId === post.id}
                                            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-60"
                                        >
                                            {actionPostId === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            Publish Now
                                        </button>
                                    )}
                                    {canSchedulePost(post) && (
                                        <button
                                            onClick={() => openScheduleModal(post)}
                                            disabled={actionPostId === post.id}
                                            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-60"
                                        >
                                            <Calendar className="h-4 w-4" />
                                            {getScheduleButtonLabel(post)}
                                        </button>
                                    )}
                                    {post.status === 'posted' && post.linkedin_url && (
                                        <a
                                            href={post.linkedin_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                                        >
                                            <Send className="h-4 w-4" />
                                            View Post
                                        </a>
                                    )}
                                    {post.status === 'posted' && (
                                        <div className="ml-auto flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 border border-slate-200">
                                            <span className="inline-flex items-center gap-1">
                                                <Heart className="h-4 w-4 text-pink-500" />
                                                {post.likes_count || 0}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <MessageSquare className="h-4 w-4 text-sky-500" />
                                                {post.comments_count || 0}
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => runPostAction(post.id, 'delete', post)}
                                        disabled={actionPostId === post.id}
                                        className={`flex items-center gap-2 px-4 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-60 ${
                                            post.status === 'posted' ? '' : 'sm:ml-auto'
                                        }`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
