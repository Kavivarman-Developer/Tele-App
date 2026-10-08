import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  type?: ToastType;
  title?: string;
  duration?: number;
}

interface ToastState {
  visible: boolean;
  message: string;
  title?: string;
  type: ToastType;
  show: (message: string, options?: ToastOptions) => void;
  hide: () => void;
}

let timeoutId: any = null;

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: '',
  title: undefined,
  type: 'info',

  show: (message: string, options?: ToastOptions) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    const type = options?.type || 'info';
    const title = options?.title;
    const duration = options?.duration || 3500;

    set({
      visible: true,
      message,
      title,
      type,
    });

    timeoutId = setTimeout(() => {
      set({ visible: false });
      timeoutId = null;
    }, duration);
  },

  hide: () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    set({ visible: false });
  },
}));

// Quick convenience helpers for direct calling anywhere in the codebase
export const toast = {
  success: (message: string, title?: string, duration?: number) => {
    useToastStore.getState().show(message, { type: 'success', title, duration });
  },
  error: (message: string, title?: string, duration?: number) => {
    useToastStore.getState().show(message, { type: 'error', title, duration });
  },
  info: (message: string, title?: string, duration?: number) => {
    useToastStore.getState().show(message, { type: 'info', title, duration });
  },
  warning: (message: string, title?: string, duration?: number) => {
    useToastStore.getState().show(message, { type: 'warning', title, duration });
  },
  hide: () => {
    useToastStore.getState().hide();
  },
};
