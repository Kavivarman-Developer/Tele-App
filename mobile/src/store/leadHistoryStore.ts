import { create } from 'zustand';
import { Activity, User } from '../types';
import { storage } from '../utils/storage';

const HISTORY_STORAGE_KEY = 'tele_crm_lead_history_v3';

export const normalizePhone = (phone?: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

interface LeadHistoryStore {
  historyMap: Record<string, Activity[]>;
  isLoaded: boolean;
  loadHistory: () => Promise<void>;
  getHistoryForLead: (leadId: string, phone?: string) => Activity[];
  getAllActivities: (agentId?: string) => Activity[];
  getTodayActivities: (agentId?: string) => Activity[];
  getYesterdayActivities: (agentId?: string) => Activity[];
  getActivitiesForPeriod: (
    period: 'Today' | '7 Days' | '30 Days' | 'Custom',
    customDate?: string | null,
    agentId?: string,
  ) => Activity[];
  clearHistory: () => Promise<void>;
  logDialedCall: (data: {
    leadId?: string;
    phone: string;
    customerName?: string;
    agentName?: string;
    agentId?: string;
    branch?: string | null;
  }) => Activity;
  addActivity: (
    leadId: string,
    activityData: {
      phone?: string;
      customerName?: string;
      branch?: string | null;
      agentName?: string;
      agentId?: string;
      connected: boolean;
      stage: string;
      tag?: string | null;
      temperature?: 'HOT' | 'WARM' | 'COLD';
      remark?: string;
      followUpAt?: string | null;
      durationSeconds?: number;
      notConnectedReason?: any;
    },
  ) => Activity;
}

export const useLeadHistoryStore = create<LeadHistoryStore>((set, get) => ({
  historyMap: {},
  isLoaded: false,

  loadHistory: async () => {
    try {
      const stored = await storage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed: Record<string, Activity[]> = JSON.parse(stored);
        // Clean out any stale demo activities
        const sanitized: Record<string, Activity[]> = {};
        for (const key of Object.keys(parsed)) {
          const list = parsed[key];
          if (Array.isArray(list)) {
            const valid = list.filter((act) => {
              if (!act || !act._id) return false;
              if (
                act._id.startsWith('act-john') ||
                act._id.startsWith('act-kavin') ||
                act._id.startsWith('act-101') ||
                act._id.startsWith('act-102') ||
                act._id.startsWith('act-501') ||
                act._id.startsWith('act-701')
              ) {
                return false;
              }
              return true;
            });
            if (valid.length > 0) {
              sanitized[key] = valid;
            }
          }
        }
        set({ historyMap: sanitized, isLoaded: true });
      } else {
        set({ historyMap: {}, isLoaded: true });
      }
    } catch {
      set({ historyMap: {}, isLoaded: true });
    }
  },

  clearHistory: async () => {
    set({ historyMap: {} });
    await storage.removeItem(HISTORY_STORAGE_KEY).catch(() => {});
  },

  getAllActivities: (agentId?: string): Activity[] => {
    const map = get().historyMap;
    const foundMap = new Map<string, Activity>();

    for (const key of Object.keys(map)) {
      const list = map[key];
      if (Array.isArray(list)) {
        for (const act of list) {
          if (act && act._id && !foundMap.has(act._id)) {
            if (agentId) {
              const uId = typeof act.userId === 'object' && act.userId ? act.userId._id : act.userId;
              const uName = typeof act.userId === 'object' && act.userId ? act.userId.name : '';
              const uEmail = typeof act.userId === 'object' && act.userId ? act.userId.email : '';
              const cleanAgentId = agentId.toLowerCase().trim();
              const match =
                (uId && uId.toLowerCase() === cleanAgentId) ||
                (uName && uName.toLowerCase() === cleanAgentId) ||
                (uEmail && uEmail.toLowerCase() === cleanAgentId);
              if (!match) continue;
            }
            foundMap.set(act._id, act);
          }
        }
      }
    }

    return Array.from(foundMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  getTodayActivities: (agentId?: string): Activity[] => {
    const all = get().getAllActivities(agentId);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;
    return all.filter((a) => {
      const t = new Date(a.createdAt).getTime();
      return t >= startOfToday && t <= endOfToday;
    });
  },

  getYesterdayActivities: (agentId?: string): Activity[] => {
    const all = get().getAllActivities(agentId);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    return all.filter((a) => {
      const t = new Date(a.createdAt).getTime();
      return t >= startOfYesterday && t < startOfToday;
    });
  },

  getActivitiesForPeriod: (
    period: 'Today' | '7 Days' | '30 Days' | 'Custom',
    customDate?: string | null,
    agentId?: string,
  ): Activity[] => {
    const all = get().getAllActivities(agentId);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

    if (period === 'Today') {
      return all.filter((a) => {
        const t = new Date(a.createdAt).getTime();
        return t >= startOfToday && t <= endOfToday;
      });
    } else if (period === '7 Days') {
      const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;
      return all.filter((a) => new Date(a.createdAt).getTime() >= sevenDaysAgo);
    } else if (period === '30 Days') {
      const thirtyDaysAgo = startOfToday - 29 * 24 * 60 * 60 * 1000;
      return all.filter((a) => new Date(a.createdAt).getTime() >= thirtyDaysAgo);
    } else if (period === 'Custom' && customDate) {
      const cd = new Date(customDate);
      const startOfCustom = new Date(cd.getFullYear(), cd.getMonth(), cd.getDate()).getTime();
      const endOfCustom = startOfCustom + 24 * 60 * 60 * 1000 - 1;
      return all.filter((a) => {
        const t = new Date(a.createdAt).getTime();
        return t >= startOfCustom && t <= endOfCustom;
      });
    }
    return all;
  },

  getHistoryForLead: (leadId: string, phone?: string): Activity[] => {
    const map = get().historyMap;
    const normPhone = normalizePhone(phone);
    const foundMap = new Map<string, Activity>();

    const addList = (list?: Activity[]) => {
      if (!list || !Array.isArray(list)) return;
      for (const act of list) {
        if (act && act._id && !foundMap.has(act._id)) {
          foundMap.set(act._id, act);
        }
      }
    };

    addList(map[leadId]);

    if (leadId.startsWith('fu-')) {
      addList(map[leadId.replace('fu-', 'lead-')]);
    } else if (leadId.startsWith('lead-')) {
      addList(map[leadId.replace('lead-', 'fu-')]);
    }

    if (normPhone) {
      addList(map[normPhone]);
      addList(map[`phone_${normPhone}`]);
      addList(map[`+91${normPhone}`]);
    }

    if (normPhone) {
      for (const key of Object.keys(map)) {
        const list = map[key];
        if (Array.isArray(list)) {
          for (const act of list) {
            if (act && act.phone && normalizePhone(act.phone) === normPhone) {
              if (!foundMap.has(act._id)) {
                foundMap.set(act._id, act);
              }
            }
          }
        }
      }
    }

    const all = Array.from(foundMap.values());
    return all.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  logDialedCall: (data) => {
    const normPhone = normalizePhone(data.phone);
    const key = data.leadId || normPhone || `dial-${Date.now()}`;
    return get().addActivity(key, {
      phone: data.phone,
      customerName: data.customerName,
      agentName: data.agentName,
      agentId: data.agentId,
      branch: data.branch,
      connected: true,
      stage: 'Call Initiated',
      tag: 'WARM',
      temperature: 'WARM',
      durationSeconds: 0,
      remark: 'Agent initiated direct dialer call',
    });
  },

  addActivity: (leadId: string, data) => {
    const currentMap = get().historyMap;
    const agentName = data.agentName || 'Agent';
    const normPhone = normalizePhone(data.phone);

    const agentUser: User = {
      _id: data.agentId || 'u-agent',
      name: agentName,
      email: `${agentName.toLowerCase().replace(/\s+/g, '')}@company.com`,
      phone: '',
      role: 'AGENT',
      branch: data.branch || null,
      isActive: true,
      canReceiveLeads: true,
      createdAt: '',
      updatedAt: '',
    };

    const newActivity: Activity = {
      _id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      leadId,
      phone: normPhone || data.phone || undefined,
      customerName: data.customerName || undefined,
      branch: data.branch || null,
      campaignId: 'camp-1',
      userId: agentUser,
      type: 'CALL',
      connected: data.connected,
      notConnectedReason: data.connected ? null : data.notConnectedReason,
      stage: data.stage,
      tag: data.tag || data.temperature || 'WARM',
      temperature: (data.temperature || data.tag || 'WARM') as any,
      remark: data.remark || null,
      followUpAt: data.followUpAt || null,
      durationSeconds: data.durationSeconds || 0,
      answers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingForLead = currentMap[leadId] || [];
    const updatedLeadActivities = [newActivity, ...existingForLead];

    const updatedMap: Record<string, Activity[]> = {
      ...currentMap,
      [leadId]: updatedLeadActivities,
    };

    if (normPhone) {
      const existingForPhone = currentMap[normPhone] || [];
      const updatedPhoneActivities = [
        newActivity,
        ...existingForPhone.filter((a) => a._id !== newActivity._id),
      ];
      updatedMap[normPhone] = updatedPhoneActivities;
      updatedMap[`phone_${normPhone}`] = updatedPhoneActivities;
    }

    set({ historyMap: updatedMap });

    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedMap)).catch(() => {});

    return newActivity;
  },
}));
