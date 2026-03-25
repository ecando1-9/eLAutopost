'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService, User } from '@/services/admin';
import {
    CreditCard,
    AlertTriangle,
    CheckCircle,
    PauseCircle,
    PlayCircle,
    ShieldX,
    Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

export default function SubscriptionsPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('active'); // Default to active
    const [actionUserId, setActionUserId] = useState<string | null>(null);

    const fetchSubscriptions = async () => {
        setIsLoading(true);
        try {
            const data = await adminService.getSubscriptions({
                status: statusFilter
            });
            setUsers(data);
        } catch (error) {
            console.error('Failed to fetch subscriptions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSubscriptions();
    }, [statusFilter]);

    const runAction = async (
        userId: string,
        action: 'hold' | 'resume' | 'activate' | 'suspend' | 'unsuspend'
    ) => {
        setActionUserId(userId);
        try {
            if (action === 'hold') {
                await adminService.holdSubscription(userId, 'Admin hold');
            } else if (action === 'resume') {
                await adminService.resumeSubscription(userId);
            } else if (action === 'activate') {
                await adminService.activateSubscription(userId);
            } else if (action === 'suspend') {
                await adminService.suspendUser(userId, 'Admin suspension');
            } else if (action === 'unsuspend') {
                await adminService.resumeUser(userId);
            }
            await fetchSubscriptions();
        } catch (error) {
            console.error(`Failed to ${action} subscription/user:`, error);
            alert(`Failed to ${action}. Please try again.`);
        } finally {
            setActionUserId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800 border-green-200';
            case 'trial': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'expired': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-red-100 text-red-800 border-red-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active': return <CheckCircle className="h-4 w-4 mr-1" />;
            case 'trial': return <CreditCard className="h-4 w-4 mr-1" />;
            case 'expired': return <AlertTriangle className="h-4 w-4 mr-1" />;
            default: return null;
        }
    };

    const getDisplayName = (user: User) => {
        const raw = (user.full_name || '').trim();
        const placeholderNames = new Set([
            'your_name_here',
            'your email here',
            'your_email_here',
            'name',
            'full name',
        ]);
        if (!raw || placeholderNames.has(raw.toLowerCase())) {
            return user.email?.split('@')[0] || 'User';
        }
        return raw;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Subscription Management</h2>
                    <p className="text-gray-500">View and manage trials and billing</p>
                </div>

                {/* Filter Tabs */}
                <div className="bg-white p-1 rounded-lg border border-gray-200 flex overflow-x-auto max-w-full">
                    {['all', 'active', 'trial', 'expired', 'cancelled', 'blocked'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`
                px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-colors
                ${statusFilter === status
                                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                }
              `}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscriber</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan Details</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Renewal/End</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Controls</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                                        <p className="mt-2 text-gray-500">Loading subscriptions...</p>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        No subscriptions found with {statusFilter} status
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 text-xs">
                                                    {getDisplayName(user).charAt(0).toUpperCase()}
                                                </div>
                                                <div className="ml-3">
                                                    <Link href={`/admin/users/${user.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                                                        {getDisplayName(user)}
                                                    </Link>
                                                    <div className="text-xs text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 font-medium">Monthly Pro</div>
                                            <div className="text-xs text-gray-500">INR 299/mo</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-0.5 inline-flex items-center text-xs font-medium rounded-full border ${getStatusColor(user.subscription_status)} capitalize`}>
                                                {getStatusIcon(user.subscription_status)}
                                                {user.subscription_status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.subscription_start ? format(new Date(user.subscription_start), 'MMM d, yyyy') :
                                                (user.trial_start ? format(new Date(user.trial_start), 'MMM d, yyyy') : '-')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.subscription_status === 'trial' ? (
                                                <div className="flex flex-col">
                                                    <span className={user.trial_end && new Date(user.trial_end) < new Date() ? 'text-red-500 font-medium' : ''}>
                                                        {user.trial_end ? format(new Date(user.trial_end), 'MMM d, yyyy') : '-'}
                                                    </span>
                                                    <span className="text-xs text-gray-400">Trial End</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span>{user.renewal_date ? format(new Date(user.renewal_date), 'MMM d, yyyy') : '-'}</span>
                                                    <span className="text-xs text-gray-400">{user.subscription_status === 'expired' ? 'Expired On' : 'Renews On'}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="inline-flex items-center gap-2">
                                                {(user.subscription_status === 'active' || user.subscription_status === 'trial') && (
                                                    <button
                                                        type="button"
                                                        disabled={actionUserId === user.id}
                                                        onClick={() => runAction(user.id, 'hold')}
                                                        className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                                                    >
                                                        {actionUserId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}
                                                        Hold
                                                    </button>
                                                )}
                                                {(user.subscription_status === 'cancelled' || user.subscription_status === 'expired') && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={actionUserId === user.id}
                                                            onClick={() => runAction(user.id, 'resume')}
                                                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                                                        >
                                                            {actionUserId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                                                            Resume
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={actionUserId === user.id}
                                                            onClick={() => runAction(user.id, 'activate')}
                                                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                                        >
                                                            {actionUserId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                                            Activate
                                                        </button>
                                                    </>
                                                )}
                                                {user.subscription_status === 'blocked' ? (
                                                    <button
                                                        type="button"
                                                        disabled={actionUserId === user.id}
                                                        onClick={() => runAction(user.id, 'unsuspend')}
                                                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                                    >
                                                        {actionUserId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                                                        Unsuspend
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={actionUserId === user.id}
                                                        onClick={() => runAction(user.id, 'suspend')}
                                                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                                                    >
                                                        {actionUserId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldX className="h-3.5 w-3.5" />}
                                                        Suspend
                                                    </button>
                                                )}

                                                <Link
                                                    href={`/admin/users/${user.id}`}
                                                    className="text-blue-600 hover:text-blue-900"
                                                >
                                                    Manage
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
