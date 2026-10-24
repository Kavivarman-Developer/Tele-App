import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import { storage } from '../utils/storage';
import { disposeLead } from '../api/leadApi';
import { DisposeLeadPayload } from '../types';

export type OutboxItemStatus = 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
export type OutboxMutationType = 'DISPOSE_LEAD' | 'UPDATE_LEAD';

export interface OutboxItem {
  id: string; // Client UUID
  idempotencyKey: string;
  type: OutboxMutationType;
  leadId: string;
  payload: DisposeLeadPayload;
  status: OutboxItemStatus;
  createdAt: string;
  updatedAt: string;
  attemptCount: number;
  lastError?: string;
  permanentFailure?: boolean;
}

interface OutboxState {
  items: OutboxItem[];
  isSyncing: boolean;
  isOnline: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  enqueueMutation: (
    type: OutboxMutationType,
    leadId: string,
    payload: DisposeLeadPayload,
    idempotencyKey?: string | null,
  ) => Promise<OutboxItem>;
  processOutbox: () => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  discardItem: (id: string) => Promise<void>;
  clearSynced: () => Promise<void>;
  getPendingCount: () => number;
  getFailedItems: () => OutboxItem[];
}

const OUTBOX_STORAGE_KEY = 'tele_app_outbox_queue_v1';

const generateUUID = (): string => {
  return 'outbox_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
};

export const useOutboxStore = create<OutboxState>((set, get) => ({
  items: [],
  isSyncing: false,
  isOnline: true,
  initialized: false,

  init: async () => {
    if (get().initialized) return;

    try {
      const stored = await storage.getItem(OUTBOX_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as OutboxItem[];
        set({ items: Array.isArray(parsed) ? parsed : [] });
      }
    } catch {
      set({ items: [] });
    }

    set({ initialized: true });

    // Set up network connectivity listener
    NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      const wasOffline = !get().isOnline;
      set({ isOnline: online });

      if (online && wasOffline) {
        // Just reconnected to network: trigger immediate outbox processing
        get().processOutbox();
      }
    });

    // Initial check
    const net = await NetInfo.fetch();
    set({ isOnline: Boolean(net.isConnected) });
    if (net.isConnected) {
      get().processOutbox();
    }
  },

  enqueueMutation: async (type, leadId, payload, existingIdempotencyKey) => {
    const id = generateUUID();
    const idempotencyKey = (existingIdempotencyKey && existingIdempotencyKey.trim()) ? existingIdempotencyKey : generateUUID();
    const item: OutboxItem = {
      id,
      idempotencyKey,
      type,
      leadId,
      payload: {
        ...payload,
        idempotencyKey,
      },
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attemptCount: 0,
    };

    const updated = [item, ...get().items];
    set({ items: updated });
    await storage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(updated));

    // If online, immediately process queue in background
    if (get().isOnline && !get().isSyncing) {
      get().processOutbox();
    }

    return item;
  },

  processOutbox: async () => {
    const { items, isSyncing, isOnline } = get();
    if (isSyncing || !isOnline) return;

    set({ isSyncing: true });

    try {
      const currentItems = [...get().items];
      let hasChanges = false;

      for (let i = 0; i < currentItems.length; i++) {
        const item = currentItems[i];
        if (item.status !== 'PENDING') continue;

        // Mark SYNCING
        currentItems[i] = {
          ...item,
          status: 'SYNCING',
          updatedAt: new Date().toISOString(),
          attemptCount: item.attemptCount + 1,
        };
        set({ items: [...currentItems] });

        try {
          if (item.type === 'DISPOSE_LEAD') {
            await disposeLead(item.leadId, item.payload);
          }

          // Marked SYNCED
          currentItems[i] = {
            ...currentItems[i],
            status: 'SYNCED',
            updatedAt: new Date().toISOString(),
          };
          hasChanges = true;
        } catch (err: any) {
          const status = err?.response?.status;
          const is4xx = status >= 400 && status < 500 && status !== 429;
          const errMsg = err?.response?.data?.message || err?.message || 'Network request failed';

          currentItems[i] = {
            ...currentItems[i],
            status: 'FAILED',
            lastError: errMsg,
            permanentFailure: is4xx,
            updatedAt: new Date().toISOString(),
          };
          hasChanges = true;
        }
      }

      // Keep SYNCED items for max 24 hours, or filter them
      const pruned = currentItems.filter((it) => {
        if (it.status === 'SYNCED') {
          const ageHours = (Date.now() - new Date(it.updatedAt).getTime()) / (1000 * 60 * 60);
          return ageHours < 2; // retain 2 hours for audit
        }
        return true;
      });

      set({ items: pruned });
      if (hasChanges) {
        await storage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(pruned));
      }
    } finally {
      set({ isSyncing: false });
    }
  },

  retryItem: async (id: string) => {
    const items = get().items.map((it) => {
      if (it.id === id) {
        return {
          ...it,
          status: 'PENDING' as OutboxItemStatus,
          permanentFailure: false,
          updatedAt: new Date().toISOString(),
        };
      }
      return it;
    });

    set({ items });
    await storage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items));
    get().processOutbox();
  },

  discardItem: async (id: string) => {
    const items = get().items.filter((it) => it.id !== id);
    set({ items });
    await storage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items));
  },

  clearSynced: async () => {
    const items = get().items.filter((it) => it.status !== 'SYNCED');
    set({ items });
    await storage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items));
  },

  getPendingCount: () => {
    return get().items.filter((it) => it.status === 'PENDING' || it.status === 'SYNCING').length;
  },

  getFailedItems: () => {
    return get().items.filter((it) => it.status === 'FAILED');
  },
}));
