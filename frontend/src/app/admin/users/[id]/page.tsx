'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminService, User } from '@/services/admin';
import {
    Mail,
    CreditCard,
    Activity,
    ShieldX,
    ArrowLeft,
    Loader2,
    PauseCircle,
    PlayCircle,
    Clock
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

export default function UserDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.id as string;

    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const getDisplayName = (targetUser: User) => {
        const raw = (targetUser.full_name || '').trim();
        const placeholderNames = new Set([
            'your_name_here',
            'your email here',
            'your_email_here',
            'name',
            'full name',
        ]);
        if (!raw || placeholderNames.has(raw.toLowerCase())) {
            const local = (targetUser.email || 'user').split('@')[0] || 'user';
            const readable = local.replace(/[._-]+/g, ' ').trim();
            return readable
                ? readable.replace(/\b\w/g, (char) => char.toUpperCase())
                : 'User';
        }
        return raw;
    };

    const fetchUser = async () => {
        try {
            const data = await adminService.getUser(userId);
            setUser(data);
        } catch (error) {
            console.error('Failed to fetch user:', error);
            alert('User not found');
            router.push('/admin/users');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (userId) fetchUser();
    }, [userId]);

    const handleExtendTrial = async () => {
        const days = prompt('How many days to extend the trial?', '7');
        if (!days) return;

        setIsProcessing(true);
        try {
            await adminService.extendTrial(userId, parseInt(days));
            fetchUser();
            alert('Trial extended successfully');
        } catch (error) {
            alert('Failed to extend trial');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelSubscription = async () => {
        if (!confirm('Are you sure you want to cancel this subscription?')) return;

        setIsProcessing(true);
        try {
            await adminService.cancelSubscription(userId);
            fetchUser();
            alert('Subscription cancelled');
        } catch (error) {
            alert('Failed to cancel subscription');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBlockUser = async () => {
        if (!user) return;
        const isBlocked = user.subscription_status === 'blocked';

        if (!confirm(`Are you sure you want to ${isBlocked ? 'resume' : 'suspend'} this user?`)) return;

        setIsProcessing(true);
        try {
            if (isBlocked) {
                await adminService.resumeUser(userId);
            } else {
                await adminService.suspendUser(userId, 'Admin action');
            }
            fetchUser();
        } catch (error) {
            alert('Action failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleHoldSubscription = async () => {
        if (!confirm('Put this subscription on hold?')) return;
        setIsProcessing(true);
        try {
            await adminService.holdSubscription(userId, 'Admin hold');
            fetchUser();
        } catch (error) {
            alert('Failed to hold subscription');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResumeSubscription = async () => {
        if (!confirm('Resume this subscription?')) return;
        setIsProcessing(true);
        try {
            await adminService.resumeSubscription(userId);
            fetchUser();
        } catch (error) {
            alert('Failed to resume subscription');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleActivateSubscription = async () => {
        if (!confirm('Activate this subscription now?')) return;
        setIsProcessing(true);
        try {
            await adminService.activateSubscription(userId);
            fetchUser();
        } catch (error) {
            alert('Failed to activate subscription');
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!user) return null;
    const displayName = getDisplayName(user);

    return (
        <div className="space-y-6">
            <Link
                href="/admin/users"
                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900"
            >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Users
            </Link>

            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center">
                        <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold shrink-0">
                            {displayName.charAt(0)}
                        </div>
                        <div className="ml-4">
                            <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
                            <div className="flex items-center text-gray-500 mt-1">
                                <Mail className="h-4 w-4 mr-1" />
                                {user.email}
                            </div>
                            <div className="flex items-center text-xs text-gray-400 mt-1">
                                <span className="uppercase bg-gray-100 px-2 py-0.5 rounded mr-2">ID: {user.id}</span>
                                <span>Joined {format(new Date(user.signup_date), 'PPP')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            disabled={isProcessing}
                            onClick={handleBlockUser}
                            className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${user.subscription_status === 'blocked'
                                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                                }`}
                        >
                            {user.subscription_status === 'blocked' ? (
                                <>
                                    <PlayCircle className="h-4 w-4 mr-2" /> Resume User
                                </>
                            ) : (
                                <>
                                    <ShieldX className="h-4 w-4 mr-2" /> Suspend User
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Subscription Card */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                            Subscription Details
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-500 mb-1">Current Status</p>
                                <div className="flex items-center">
                                    <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full capitalize
                    ${user.subscription_status === 'active' ? 'bg-green-100 text-green-800' :
                                            user.subscription_status === 'trial' ? 'bg-blue-100 text-blue-800' :
                                                user.subscription_status === 'expired' ? 'bg-orange-100 text-orange-800' :
                                                    'bg-red-100 text-red-800'
                                        }
                  `}>
                                        {user.subscription_status}
                                    </span>
                                </div>
                            </div>

                            {user.subscription_status === 'active' && (
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-500 mb-1">Next Renewal</p>
                                    <p className="font-semibold text-gray-900">
                                        {user.renewal_date ? format(new Date(user.renewal_date), 'PPP') : 'N/A'}
                                    </p>
                                    <div className="mt-2 flex gap-3">
                                        <button
                                            onClick={handleHoldSubscription}
                                            disabled={isProcessing}
                                            className="inline-flex items-center text-sm text-amber-700 hover:text-amber-800 font-medium disabled:opacity-50"
                                        >
                                            <PauseCircle className="h-4 w-4 mr-1" />
                                            Hold
                                        </button>
                                        <button
                                            onClick={handleCancelSubscription}
                                            disabled={isProcessing}
                                            className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {(user.subscription_status === 'trial') && (
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-500 mb-1">
                                        Trial ends {user.trial_end ? format(new Date(user.trial_end), 'PPP') : 'N/A'}
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleExtendTrial}
                                            disabled={isProcessing}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                                        >
                                            + Extend Trial
                                        </button>
                                        <button
                                            onClick={handleHoldSubscription}
                                            disabled={isProcessing}
                                            className="inline-flex items-center text-sm text-amber-700 hover:text-amber-800 font-medium disabled:opacity-50"
                                        >
                                            <PauseCircle className="h-4 w-4 mr-1" />
                                            Hold
                                        </button>
                                    </div>
                                </div>
                            )}

                            {(user.subscription_status === 'cancelled' || user.subscription_status === 'expired') && (
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-500 mb-1">Resume Access</p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleResumeSubscription}
                                            disabled={isProcessing}
                                            className="inline-flex items-center text-sm text-blue-700 hover:text-blue-800 font-medium disabled:opacity-50"
                                        >
                                            <PlayCircle className="h-4 w-4 mr-1" />
                                            Resume
                                        </button>
                                        <button
                                            onClick={handleActivateSubscription}
                                            disabled={isProcessing}
                                            className="text-sm text-emerald-700 hover:text-emerald-800 font-medium disabled:opacity-50"
                                        >
                                            Activate Paid
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <Activity className="h-5 w-5 mr-2 text-indigo-600" />
                            Usage Statistics
                        </h3>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="text-center p-4 border rounded-lg">
                                <p className="text-2xl font-bold text-gray-900">{user.posts_generated}</p>
                                <p className="text-xs text-gray-500 mt-1">Posts Generated</p>
                            </div>
                            <div className="text-center p-4 border rounded-lg">
                                <p className="text-2xl font-bold text-gray-900">{user.images_generated}</p>
                                <p className="text-xs text-gray-500 mt-1">Images Created</p>
                            </div>
                            <div className="text-center p-4 border rounded-lg">
                                <p className="text-2xl font-bold text-gray-900">{user.linkedin_posts}</p>
                                <p className="text-xs text-gray-500 mt-1">Published</p>
                            </div>
                            <div className="text-center p-4 border rounded-lg">
                                <p className="text-2xl font-bold text-gray-900">{user.api_calls}</p>
                                <p className="text-xs text-gray-500 mt-1">API Calls</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Activity Log (Placeholder / could be fetched separately) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <Clock className="h-5 w-5 mr-2 text-gray-600" />
                        Recent Activity
                    </h3>
                    <div className="space-y-4">
                        {user.last_activity ? (
                            <div className="flex items-start">
                                <div className="h-2 w-2 rounded-full bg-green-500 mt-2 mr-3" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Last Active</p>
                                    <p className="text-xs text-gray-500">{format(new Date(user.last_activity), 'PPP p')}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">No recent activity recorded.</p>
                        )}

                        {user.last_login_at && (
                            <div className="flex items-start">
                                <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 mr-3" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Last Login</p>
                                    <p className="text-xs text-gray-500">{format(new Date(user.last_login_at), 'PPP p')}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-start">
                            <div className="h-2 w-2 rounded-full bg-gray-300 mt-2 mr-3" />
                            <div>
                                <p className="text-sm font-medium text-gray-900">Account Created</p>
                                <p className="text-xs text-gray-500">{format(new Date(user.signup_date), 'PPP p')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
