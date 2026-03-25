'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService, User } from '@/services/admin';
import {
    Search,
    MoreHorizontal,
    Shield,
    ShieldOff,
    Eye,
    Loader2,
    Filter
} from 'lucide-react';
import { format } from 'date-fns';

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const data = await adminService.getUsers({
                search: searchTerm,
                status: statusFilter || undefined
            });
            setUsers(data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            fetchUsers();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, statusFilter]);

    const handleBlockUser = async (userId: string, isBlocked: boolean) => {
        if (!confirm(`Are you sure you want to ${isBlocked ? 'unblock' : 'block'} this user?`)) return;

        try {
            if (isBlocked) {
                await adminService.unblockUser(userId);
            } else {
                await adminService.blockUser(userId, 'Admin action');
            }
            fetchUsers(); // Refresh list
        } catch (error) {
            alert('Action failed');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'trial': return 'bg-blue-100 text-blue-800';
            case 'expired': return 'bg-orange-100 text-orange-800';
            case 'blocked': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
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
            const local = (user.email || 'user').split('@')[0] || 'user';
            const readable = local.replace(/[._-]+/g, ' ').trim();
            return readable
                ? readable.replace(/\b\w/g, (char) => char.toUpperCase())
                : 'User';
        }
        return raw;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                    <p className="text-gray-500">Manage all registered users</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* Filter */}
                    <select
                        className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="trial">Trial</option>
                        <option value="expired">Expired</option>
                        <option value="blocked">Blocked</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                                        <p className="mt-2 text-gray-500">Loading users...</p>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        No users found matching your criteria
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                                                    {getDisplayName(user).charAt(0)}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{getDisplayName(user)}</div>
                                                    <div className="text-sm text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(user.subscription_status)} capitalize`}>
                                                {user.subscription_status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.subscription_status === 'trial' ? (
                                                <span>Free Trial<br /><span className="text-xs">Ends {user.trial_end ? format(new Date(user.trial_end), 'MMM d, yyyy') : '-'}</span></span>
                                            ) : (
                                                <span>Pro Plan<br /><span className="text-xs">renews {user.renewal_date ? format(new Date(user.renewal_date), 'MMM d') : '-'}</span></span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex flex-col">
                                                <span>{user.posts_generated} posts</span>
                                                <span className="text-xs">{user.linkedin_posts} published</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {format(new Date(user.signup_date), 'MMM d, yyyy')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/admin/users/${user.id}`}
                                                    className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50"
                                                    title="View Details"
                                                >
                                                    <Eye className="h-5 w-5" />
                                                </Link>
                                                <button
                                                    onClick={() => handleBlockUser(user.id, user.subscription_status === 'blocked')}
                                                    className={`p-2 rounded-full hover:bg-red-50 ${user.subscription_status === 'blocked'
                                                            ? 'text-red-500 hover:text-red-700'
                                                            : 'text-gray-400 hover:text-red-600'
                                                        }`}
                                                    title={user.subscription_status === 'blocked' ? 'Unblock User' : 'Block User'}
                                                >
                                                    {user.subscription_status === 'blocked' ? (
                                                        <ShieldOff className="h-5 w-5" />
                                                    ) : (
                                                        <Shield className="h-5 w-5" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                        Showing <span className="font-medium">{users.length}</span> results
                    </span>
                    {/* Pagination controls could go here */}
                </div>
            </div>
        </div>
    );
}
