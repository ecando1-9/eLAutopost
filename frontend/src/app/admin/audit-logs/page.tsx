'use client';

import { useEffect, useState } from 'react';
import { adminService } from '@/services/admin';
import {
    ShieldAlert,
    Loader2,
    User,
    Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
    id: string;
    admin_id: string;
    action: string;
    target_user_id?: string;
    details: any;
    ip_address: string;
    user_agent?: string;
    created_at: string;
    // Join fields if available
    admin_email?: string;
    target_user_email?: string;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionFilter, setActionFilter] = useState('');
    const actionOptions = [
        '',
        'user_blocked',
        'user_unblocked',
        'trial_extended',
        'subscription_activated',
        'subscription_cancelled',
        'usage_reset',
        'role_changed',
    ];

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const data = await adminService.getAuditLogs({
                action: actionFilter || undefined
            });
            // Handle paginated response
            setLogs(Array.isArray(data) ? data : data.logs || []);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
            setLogs([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [actionFilter]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
                    <p className="text-gray-500">Track all administrative actions</p>
                </div>

                <select
                    className="w-full sm:w-64 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                >
                    {actionOptions.map((action) => (
                        <option key={action || 'all'} value={action}>
                            {action ? action : 'All Actions'}
                        </option>
                    ))}
                </select>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                                        <p className="mt-2 text-gray-500">Loading audit logs...</p>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        No audit logs found
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex items-center">
                                                <Clock className="h-4 w-4 mr-2 text-gray-400" />
                                                {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                            <span className="flex items-center">
                                                <User className="h-4 w-4 mr-1 text-gray-400" />
                                                {log.admin_id.substring(0, 8)}...
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-md bg-gray-100 text-gray-800 border border-gray-200">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {log.target_user_id ? log.target_user_id.substring(0, 8) + '...' : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={JSON.stringify(log.details)}>
                                            {JSON.stringify(log.details)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                                            {log.ip_address}
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
