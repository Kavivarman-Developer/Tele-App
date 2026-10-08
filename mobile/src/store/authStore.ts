import { create } from 'zustand';
import axios from 'axios';
import { User } from '../types';
import { storage } from '../utils/storage';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'tele_app_auth_token';
const USER_KEY = 'tele_app_auth_user';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  error: null,

  login: async (email: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post<{ token: string; user: User }>(
        `${API_BASE_URL}/auth/login`,
        { email: email.trim(), password },
      );

      const { token, user } = response.data;

      await storage.setItem(TOKEN_KEY, token);
      await storage.setItem(USER_KEY, JSON.stringify(user));

      set({ token, user, isLoading: false, error: null });
      return true;
    } catch (err: unknown) {
      let errorMessage = 'Login failed. Please check your credentials.';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.message || err.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  logout: async (): Promise<void> => {
    await storage.removeItem(TOKEN_KEY);
    await storage.removeItem(USER_KEY);
    set({ user: null, token: null, error: null, isLoading: false });
  },

  restoreSession: async (): Promise<void> => {
    set({ isLoading: true });
    try {
      const token = await storage.getItem(TOKEN_KEY);

      if (!token) {
        set({ user: null, token: null, isLoading: false });
        return;
      }

      // Verify token with backend
      const response = await axios.get<{ user: User }>(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });

      const user = response.data.user;
      await storage.setItem(USER_KEY, JSON.stringify(user));

      set({ token, user, isLoading: false, error: null });
    } catch {
      // If network fails but token & cached user exist, restore from cache
      const cachedUserStr = await storage.getItem(USER_KEY);
      const token = await storage.getItem(TOKEN_KEY);

      if (token && cachedUserStr) {
        try {
          const user = JSON.parse(cachedUserStr) as User;
          set({ token, user, isLoading: false, error: null });
          return;
        } catch {
          // parse failed
        }
      }

      // Otherwise invalidate token
      await storage.removeItem(TOKEN_KEY);
      await storage.removeItem(USER_KEY);
      set({ token: null, user: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
