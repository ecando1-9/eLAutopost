import axios from 'axios';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const RAW_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').trim();
const API_BASE_URL = RAW_API_URL.endsWith('/api/v1')
    ? RAW_API_URL
    : `${RAW_API_URL.replace(/\/$/, '')}/api/v1`;

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(async (config) => {
    const supabase = createClientComponentClient();

    const { data: { session } } = await supabase.auth.getSession();

    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }

    return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle 401 Unauthorized globally if needed
        if (error.response && error.response.status === 401) {
            // Could redirect to login here but usually better handled by guards
            console.error('Unauthorized access');
        }
        return Promise.reject(error);
    }
);

export default api;
