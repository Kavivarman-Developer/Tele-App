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

// Request Interceptor: Normalize duplicate /api prefix and attach Bearer JWT token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // If url starts with '/api/' and baseURL already contains '/api', remove duplicate prefix
    if (config.url && config.url.startsWith('/api/')) {
      config.url = config.url.replace(/^\/api/, '');
    }
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// Response Interceptor: Handle 401 unauthorized by logging out
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      console.warn('[API Client] 401 Unauthorized encountered. Logging out user.');
      await useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
