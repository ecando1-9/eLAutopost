import axios from 'axios';

const api = axios.create({
    baseURL: '/api/v1',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
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
