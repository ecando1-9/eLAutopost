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
    ArrowDownUp,
    Heart,
    MessageSquare,
    Filter,
    Trash2,
    Send,
    Eye,
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

export default function PostsPage() {
    const router = useRouter();
    const supabase = createClientComponentClient();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'created' | 'scheduled'>('created');
    const [actionPostId, setActionPostId] = useState<string | null>(null);
    const [previewPost, setPreviewPost] = useState<Post | null>(null);
    const [scheduleModal, setScheduleModal] = useState<Post | null>(null);
    const [scheduleDate, setScheduleDate] = useState(() => {
        const base = new Date();
        base.setDate(base.getDate() + 1);
        base.setHours(9, 0, 0, 0);
        const tzOffsetMs = base.getTimezoneOffset() * 60000;
        return new Date(base.getTime() - tzOffsetMs).toISOString().slice(0, 16);
    });

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
            result = result.filter(p => p.status === statusFilter);
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
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // Newest first
            }
        });

        return result;
    }, [posts, statusFilter, searchQuery, sortBy]);

    const getStatusBadge = (status: string) => {
        const styles = {
            draft: 'bg-gray-100 text-gray-800 border-gray-200',
            scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
            posted: 'bg-green-100 text-green-800 border-green-200',
            failed: 'bg-red-100 text-red-800 border-red-200'
        };

        const icons = {
            draft: <Clock className="h-3 w-3" />,
            scheduled: <Calendar className="h-3 w-3" />,
            posted: <CheckCircle2 className="h-3 w-3" />,
            failed: <XCircle className="h-3 w-3" />
        };

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
                {icons[status as keyof typeof icons]}
                {status.charAt(0).toUpperCase() + status.slice(1)}
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
            let response: Response;

            if (action === 'publish') {
                response = await fetch(`/api/v1/posts/${postId}/publish`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        scheduled_at: scheduledAt,
                        target: post?.target || 'person',
                        organization_id: post?.organization_id || '',
                    }),
                });
            } else {
                response = await fetch(`/api/v1/posts/${postId}`, {
                    method: 'DELETE',
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
                                    Schedule Post
                                </h3>
                                <button onClick={() => setScheduleModal(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 mb-1 font-medium">Topic: <span className="text-gray-900">{scheduleModal.topic}</span></p>
                            <p className="text-sm text-gray-500 mb-4">Choose when to publish this post:</p>
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
                                    Confirm Schedule
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
                                onClick={() => setSortBy('created')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${sortBy === 'created' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Clock className="h-3.5 w-3.5" /> Newest First
                            </button>
                            <button
                                onClick={() => setSortBy('scheduled')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${sortBy === 'scheduled' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Calendar className="h-3.5 w-3.5" /> Scheduled Next
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <Filter className="h-4 w-4 text-slate-400 shrink-0 mr-1" />
                        <div className="flex gap-1.5">
                            {['all', 'pending_review', 'scheduled', 'posted', 'draft', 'failed'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${statusFilter === status
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                >
                                    {status === 'all' ? 'All' : status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </button>
                            ))}
                        </div>
                    </div>
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
                                        <p className="text-sm text-gray-500">
                                            Created {format(new Date(post.created_at), 'MMM d, yyyy HH:mm')}
                                        </p>
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

                                {/* Scheduled Time */}
                                {post.scheduled_at && (
                                    <div className="mb-4 flex items-center text-sm text-gray-600">
                                        <Clock className="h-4 w-4 mr-2" />
                                        Scheduled for {format(new Date(post.scheduled_at), 'MMM d, yyyy HH:mm')}
                                    </div>
                                )}

                                <div className="mb-4">
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                        Target: {post.target === 'organization' ? 'LinkedIn Page' : 'LinkedIn Profile'}
                                    </span>
                                </div>

                                {/* Posted Time */}
                                {post.posted_at && (
                                    <div className="mb-4 flex items-center text-sm text-green-600">
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Posted on {format(new Date(post.posted_at), 'MMM d, yyyy HH:mm')}
                                    </div>
                                )}

                                {/* Error Message */}
                                {post.error_message && (
                                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                                        <p className="text-sm text-red-700">
                                            <strong>Error:</strong> {post.error_message}
                                        </p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 pt-4 border-t border-gray-200">
                                    <button
                                        onClick={() => setPreviewPost(post)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                                    >
                                        <Eye className="h-4 w-4" />
                                        Preview
                                    </button>
                                    {['draft', 'failed', 'pending_review'].includes(post.status) && (
                                        <button
                                            onClick={() => runPostAction(post.id, 'publish', post)}
                                            disabled={actionPostId === post.id}
                                            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-60"
                                        >
                                            {actionPostId === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            Publish Now
                                        </button>
                                    )}
                                    {['draft', 'failed', 'pending_review'].includes(post.status) && (
                                        <button
                                            onClick={() => {
                                                if (post.scheduled_at) {
                                                    const d = new Date(post.scheduled_at);
                                                    const tzOffset = d.getTimezoneOffset() * 60000;
                                                    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
                                                    setScheduleDate(localISOTime);
                                                } else {
                                                    const d = new Date(Date.now() + 3600000);
                                                    const tzOffset = d.getTimezoneOffset() * 60000;
                                                    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
                                                    setScheduleDate(localISOTime);
                                                }
                                                setScheduleModal(post);
                                            }}
                                            disabled={actionPostId === post.id}
                                            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-60"
                                        >
                                            <Calendar className="h-4 w-4" />
                                            {post.status === 'pending_review' ? 'Approve & Schedule' : 'Schedule'}
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
                                    <button
                                        onClick={() => runPostAction(post.id, 'delete', post)}
                                        disabled={actionPostId === post.id}
                                        className="flex items-center gap-2 px-4 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors ml-auto disabled:opacity-60"
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
