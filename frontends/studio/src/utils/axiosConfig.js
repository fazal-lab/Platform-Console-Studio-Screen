import axios from 'axios';

// Configure default base URL if needed, though proxy handles it in dev
// axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || '';

// Request interceptor for API calls
axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        // Don't attach Studio JWT to Console API calls — Console doesn't use Studio auth
        // Don't attach Studio JWT to XIA API calls — XIA backend uses its own auth
        const isConsoleApi = config.url && config.url.includes('/api/console/');
        const isXiaApi = config.url && config.url.includes('/xia/');
        if (token && !isConsoleApi && !isXiaApi) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for API calls
axios.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            // Skip redirect if the request explicitly opted out (e.g. background calls)
            if (originalRequest._skipAuthRedirect) {
                return Promise.reject(error);
            }

            // Don't redirect to login for Console API 401s — let the component handle it
            const isConsoleApi = originalRequest.url && originalRequest.url.includes('/api/console/');
            if (isConsoleApi) {
                return Promise.reject(error);
            }

            // Token expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('isLoggedIn');

            // Only redirect if not already on a public page
            const publicPaths = ['/login', '/register', '/forgot-password', '/verify-code', '/reset-password', '/'];
            const currentPath = window.location.pathname;
            if (!publicPaths.includes(currentPath)) {
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }
        return Promise.reject(error);
    }
);

export default axios;
