import api from '@/lib/api';

export interface AdminUser {
    id: string;
    email: string;
    full_name: string;
    role: 'admin' | 'user';
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
    trial_start?: string;
    trial_end?: string;
    subscription_start?: string;
    renewal_date?: string;
    price?: number;
    posts_generated: number;
    images_generated: number;
    linkedin_posts: number;
    api_calls: number;
    last_activity?: string;
    automation?: {
        linkedin_connected: boolean;
        linkedin_token_expires_at?: string;
        auto_post: boolean;
        max_posts_per_day: number;
        publish_target: string;
        organization_id?: string;
        schedule_active: boolean;
        auto_topic: boolean;
        timezone: string;
        days_of_week: string[];
        time_of_day?: string;
        categories: string[];
        generated_today: number;
        posted_today: number;
        queue_total: number;
        tomorrow_generated: number;
        tomorrow_in_queue: number;
        tomorrow_by_status: Record<string, number>;
        tomorrow_posts: Array<{
            id: string;
            status: string;
            scheduled_at?: string;
            topic?: string;
        }>;
        next_post?: {
            id: string;
            status: string;
            scheduled_at?: string;
            topic?: string;
        };
        health: 'ok' | 'needs_attention' | 'error';
        reasons: string[];
    };
}

export interface RevenueAnalytics {
    month: string;
    new_subscriptions: number;
    revenue: number;
    mrr_added: number;
}

export interface UsageAnalytics {
    date: string;
    active_users: number;
    total_posts: number;
    total_images: number;
    total_linkedin_posts: number;
    total_api_calls: number;
}

export interface SystemInsight {
    payment_failures_24h: number;
    failed_posts_24h: number;
    webhook_events_24h: number;
    admin_actions_24h: number;
    recent_payment_errors: Array<{
        id: string;
        user_id?: string;
        status: string;
        amount?: number;
        currency?: string;
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        error_message?: string;
        created_at?: string;
        updated_at?: string;
    }>;
    recent_post_errors: Array<{
        id: string;
        user_id?: string;
        topic?: string;
        status: string;
        error_message?: string;
        created_at?: string;
        updated_at?: string;
    }>;
    recent_webhook_events: Array<{
        id: string;
        provider: string;
        event_id?: string;
        event_type: string;
        created_at: string;
    }>;
}

export interface BillingPlanSettings {
    plan_name: string;
    display_name: string;
    amount_paise: number;
    currency: string;
    billing_period_days: number;
    checkout_description?: string;
    is_active: boolean;
}

export interface BillingCoupon {
    id: string;
    code: string;
    description?: string;
    discount_type: 'percent' | 'fixed';
    discount_value: number;
    max_redemptions?: number;
    redeemed_count: number;
    starts_at?: string;
    ends_at?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export type SubscriptionControlStatus = 'trial' | 'active' | 'expired' | 'cancelled' | 'blocked';

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
        const { data } = await api.get<RevenueAnalytics[]>('/admin/analytics/revenue');
        return data;
    },

    getUsageAnalytics: async () => {
        const { data } = await api.get<UsageAnalytics[]>('/admin/analytics/usage');
        return data;
    },

    getSystemInsights: async () => {
        const { data } = await api.get<SystemInsight>('/admin/system/insights');
        return data;
    },

    // Users
    getUsers: async (params?: { search?: string; status?: string; page?: number; page_size?: number }) => {
        const { data } = await api.post('/admin/users/search', {
            search: params?.search || null,
            status: params?.status || null,
            page: params?.page || 1,
            page_size: params?.page_size || 50,
        });
        return data?.users || [];
    },

    getUser: async (id: string) => {
        const { data } = await api.get<User>(`/admin/users/${id}`);
        return data;
    },

    blockUser: async (id: string, reason?: string) => {
        const { data } = await api.post('/admin/users/block', { user_id: id, reason });
        return data;
    },

    unblockUser: async (id: string) => {
        const { data } = await api.post('/admin/users/unblock', { user_id: id });
        return data;
    },

    suspendUser: async (id: string, reason?: string) => {
        const { data } = await api.post('/admin/users/suspend', { user_id: id, reason });
        return data;
    },

    resumeUser: async (id: string) => {
        const { data } = await api.post('/admin/users/resume', { user_id: id });
        return data;
    },

    // Subscriptions
    getSubscriptions: async (params?: { status?: string; page?: number; page_size?: number }) => {
        // UI expects user+subscription combined rows, so use users search view.
        const { data } = await api.post('/admin/users/search', {
            search: null,
            status: params?.status && params.status !== 'all' ? params.status : null,
            page: params?.page || 1,
            page_size: params?.page_size || 100,
        });
        return data?.users || [];
    },

    extendTrial: async (userId: string, days: number) => {
        const { data } = await api.post('/admin/subscriptions/extend-trial', {
            user_id: userId,
            days,
        });
        return data;
    },

    setTrial: async (userId: string, days: number, reason?: string) => {
        const { data } = await api.post('/admin/subscriptions/set-trial', {
            user_id: userId,
            days,
            reason,
        });
        return data;
    },

    cancelSubscription: async (userId: string, logic: 'immediate' | 'end_of_period' = 'end_of_period') => {
        const { data } = await api.post('/admin/subscriptions/cancel', {
            user_id: userId,
        });
        return data;
    },

    holdSubscription: async (userId: string, reason?: string) => {
        const { data } = await api.post('/admin/subscriptions/hold', {
            user_id: userId,
            reason,
        });
        return data;
    },

    resumeSubscription: async (userId: string) => {
        const { data } = await api.post('/admin/subscriptions/resume', {
            user_id: userId,
        });
        return data;
    },

    activateSubscription: async (userId: string) => {
        const { data } = await api.post('/admin/subscriptions/activate', {
            user_id: userId,
        });
        return data;
    },

    getBillingPlan: async () => {
        const { data } = await api.get<BillingPlanSettings>('/admin/billing/plan');
        return data;
    },

    updateBillingPlan: async (payload: Omit<BillingPlanSettings, 'is_active'>) => {
        const { data } = await api.put<BillingPlanSettings>('/admin/billing/plan', payload);
        return data;
    },

    getBillingCoupons: async () => {
        const { data } = await api.get<BillingCoupon[]>('/admin/billing/coupons');
        return data;
    },

    createBillingCoupon: async (payload: {
        code: string;
        description?: string;
        discount_type: 'percent' | 'fixed';
        discount_value: number;
        max_redemptions?: number;
        starts_at?: string;
        ends_at?: string;
        is_active: boolean;
    }) => {
        const { data } = await api.post<BillingCoupon>('/admin/billing/coupons', payload);
        return data;
    },

    updateBillingCoupon: async (id: string, payload: Partial<BillingCoupon>) => {
        const { data } = await api.patch<BillingCoupon>(`/admin/billing/coupons/${id}`, payload);
        return data;
    },

    // Audit Logs
    getAuditLogs: async (params?: { page?: number; page_size?: number; action?: string; admin_id?: string }) => {
        const { data } = await api.get('/admin/audit-logs', {
            params: {
                page: params?.page || 1,
                page_size: params?.page_size || 50,
                action_filter: params?.action || undefined,
                admin_filter: params?.admin_id || undefined,
            },
        });
        return data;
    },
};
