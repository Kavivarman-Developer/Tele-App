import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config';
import { useAuthStore } from '../store/authStore';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Normalize duplicate /api prefix and attach Bearer JWT token if valid
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // If url starts with '/api/' and baseURL already contains '/api', remove duplicate prefix
    if (config.url && config.url.startsWith('/api/')) {
      config.url = config.url.replace(/^\/api/, '');
    }
    const token = useAuthStore.getState().token;
    // Only attach authorization header if it's a real JWT token from the server
    if (
      token &&
      config.headers &&
      !token.startsWith('auth-session-') &&
      !token.startsWith('demo-') &&
      !token.startsWith('mock-')
    ) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// Response Interceptor: Preserve active session, never forcibly logout on background 401s
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Gracefully propagate error to calling query or mutation without destroying local session
    return Promise.reject(error);
  },
);
