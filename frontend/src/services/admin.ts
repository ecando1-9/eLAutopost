import api from '@/lib/api';

export interface AdminUser {
    id: string;
    email: string;
    full_name: string;
    role: 'admin';
}

export interface DashboardStats {
    total_users: number;
    active_subscribers: number;
    trial_users: number;
    expired_trials: number;
    blocked_users: number;
    mrr: number;
    new_users_this_month: number;
    new_subscribers_this_month: number;
}

export interface User {
    id: string;
    email: string;
    full_name: string;
    signup_date: string;
    last_login_at?: string;
    role: 'admin' | 'user';
    subscription_status: 'trial' | 'active' | 'expired' | 'cancelled' | 'blocked';
    trial_end?: string;
    subscription_start?: string;
    renewal_date?: string;
    posts_generated: number;
    images_generated: number;
    linkedin_posts: number;
    api_calls: number;
    last_activity?: string;
}

export const adminService = {
    // Auth & Profile
    getCurrentAdmin: async () => {
        const { data } = await api.get<AdminUser>('/admin/me');
        return data;
    },

    // Dashboard
    getDashboardStats: async () => {
        const { data } = await api.get<DashboardStats>('/admin/dashboard/stats');
        return data;
    },

    getRevenueAnalytics: async () => {
        const { data } = await api.get('/admin/analytics/revenue');
        return data;
    },

    getUsageAnalytics: async () => {
        const { data } = await api.get('/admin/analytics/usage');
        return data;
    },

    // Users
    getUsers: async (params?: { skip?: number; limit?: number; search?: string; status?: string }) => {
        const { data } = await api.get<User[]>('/admin/users', { params });
        return data;
    },

    getUser: async (id: string) => {
        const { data } = await api.get<User>(`/admin/users/${id}`);
        return data;
    },

    blockUser: async (id: string, reason?: string) => {
        const { data } = await api.post(`/admin/users/${id}/block`, { reason });
        return data;
    },

    unblockUser: async (id: string) => {
        const { data } = await api.post(`/admin/users/${id}/unblock`);
        return data;
    },

    // Subscriptions
    getSubscriptions: async (params?: { skip?: number; limit?: number; status?: string }) => {
        const { data } = await api.get('/admin/subscriptions', { params });
        return data;
    },

    extendTrial: async (userId: string, days: number) => {
        const { data } = await api.post(`/admin/subscriptions/${userId}/extend-trial`, { days });
        return data;
    },

    cancelSubscription: async (userId: string, logic: 'immediate' | 'end_of_period' = 'end_of_period') => {
        const { data } = await api.post(`/admin/subscriptions/${userId}/cancel`, { cancel_logic: logic });
        return data;
    },

    // Audit Logs
    getAuditLogs: async (params?: { skip?: number; limit?: number; action?: string; admin_id?: string }) => {
        const { data } = await api.get('/admin/audit-logs', { params });
        return data;
    },
};
