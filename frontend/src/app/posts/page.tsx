'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    Calendar,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Filter,
    Trash2,
    Send
} from 'lucide-react';
import { format } from 'date-fns';
import AppShell from '@/components/AppShell';

interface Post {
    id: string;
    topic: string;
    hook: string;
    caption: string;
    image_prompt: string;
    image_url?: string;
    status: 'draft' | 'scheduled' | 'posted' | 'failed';
    scheduled_at?: string;
    posted_at?: string;
    linkedin_url?: string;
    error_message?: string;
    target?: 'person' | 'organization';
    organization_id?: string;
    created_at: string;
}

export default function PostsPage() {
    const router = useRouter();
    const supabase = createClientComponentClient();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [actionPostId, setActionPostId] = useState<string | null>(null);

    useEffect(() => {
        fetchPosts();
    }, [statusFilter]);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            const url = statusFilter === 'all'
                ? '/api/v1/user/queue'
                : `/api/v1/user/queue?status_filter=${statusFilter}`;

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
        post?: Post
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
                const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
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
                const text = await response.text();
                throw new Error(text || `Failed to ${action} post`);
            }

            await fetchPosts();
        } catch (error) {
            console.error(`Failed to ${action} post:`, error);
        } finally {
            setActionPostId(null);
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
                {/* Filters */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">Filter by status:</span>
                        <div className="flex gap-2">
                            {['all', 'draft', 'scheduled', 'posted', 'failed'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${statusFilter === status
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
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
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                        <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No posts found</h3>
                        <p className="text-gray-500 mb-6">
                            {statusFilter === 'all'
                                ? 'Start by creating your first post'
                                : `No ${statusFilter} posts found`
                            }
                        </p>
                        <button
                            onClick={() => router.push('/content/create')}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Create Post
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {posts.map(post => (
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
                                    {(post.status === 'draft' || post.status === 'failed') && (
                                        <button
                                            onClick={() => runPostAction(post.id, 'publish', post)}
                                            disabled={actionPostId === post.id}
                                            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-60"
                                        >
                                            {actionPostId === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            Publish Now
                                        </button>
                                    )}
                                    {(post.status === 'draft' || post.status === 'failed') && (
                                        <button
                                            onClick={() => runPostAction(post.id, 'schedule', post)}
                                            disabled={actionPostId === post.id}
                                            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-60"
                                        >
                                            <Calendar className="h-4 w-4" />
                                            Schedule
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
