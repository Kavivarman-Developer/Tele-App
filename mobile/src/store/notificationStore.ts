import { create } from 'zustand';
import { storage } from '../utils/storage';

const NOTIFICATIONS_STORAGE_KEY = 'tele_crm_read_notifications_v1';

interface NotificationStore {
  readIds: string[];
  unreadCount: number;
  isLoaded: boolean;
  loadNotifications: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: (allIds?: string[]) => void;
  resetAll: () => void;
  isRead: (id: string) => boolean;
  setTotalRemindersCount: (total: number, ids?: string[]) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  readIds: [],
  unreadCount: 4, // Initial unread count matching default reminders
  isLoaded: false,

  loadNotifications: async () => {
    try {
      const stored = await storage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        set((state) => {
          const newUnread = Math.max(0, 4 - parsed.length);
          return { readIds: parsed, unreadCount: newUnread, isLoaded: true };
        });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  isRead: (id: string) => {
    return get().readIds.includes(id);
  },

  markAsRead: (id: string) => {
    const current = get().readIds;
    if (current.includes(id)) return;

    const updated = [...current, id];
    const newCount = Math.max(0, get().unreadCount - 1);
    set({ readIds: updated, unreadCount: newCount });

    storage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
  },

  markAllAsRead: (allIds?: string[]) => {
    const current = get().readIds;
    const combined = Array.from(new Set([...current, ...(allIds || [])]));
    set({ readIds: combined, unreadCount: 0 });
    storage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(combined)).catch(() => {});
  },

  resetAll: () => {
    set({ readIds: [], unreadCount: 4 });
    storage.removeItem(NOTIFICATIONS_STORAGE_KEY).catch(() => {});
  },

  setTotalRemindersCount: (total: number, ids?: string[]) => {
    const read = get().readIds;
    if (ids && ids.length > 0) {
      const unread = ids.filter((id) => !read.includes(id)).length;
      set({ unreadCount: unread });
    } else {
      const unread = Math.max(0, total - read.length);
      set({ unreadCount: unread });
    }
  },
}));
