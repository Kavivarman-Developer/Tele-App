import { create } from 'zustand';
import { Activity, User } from '../types';
import { storage } from '../utils/storage';
import { fetchUserActivities } from '../api/leadApi';

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
      type?: 'CALL' | 'UPDATE';
      stage: string;
      tag?: string | null;
      temperature?: 'HOT' | 'WARM' | 'COLD';
      remark?: string;
      followUpAt?: string | null;
      durationSeconds?: number;
      notConnectedReason?: any;
    },
  ) => Activity;
  updateLeadName: (leadId: string, newName: string) => void;
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

      // Background sync with MongoDB server activities
      fetchUserActivities()
        .then((serverActs) => {
          if (serverActs && serverActs.length > 0) {
            const currentMap = { ...get().historyMap };
            let hasNew = false;

            for (const act of serverActs) {
              const leadKey = act.leadId || `lead-${act._id}`;
              const normPhone = normalizePhone(act.phone);

              // 1. Merge into leadKey list
              const existingLeadList = currentMap[leadKey] || [];
              if (!existingLeadList.some((e) => e._id === act._id)) {
                currentMap[leadKey] = [act, ...existingLeadList];
                hasNew = true;
              }

              // 2. Merge into phone list
              if (normPhone) {
                const existingPhoneList = currentMap[normPhone] || [];
                if (!existingPhoneList.some((e) => e._id === act._id)) {
                  currentMap[normPhone] = [act, ...existingPhoneList];
                  hasNew = true;
                }
              }
            }

            if (hasNew) {
              set({ historyMap: currentMap });
              storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(currentMap)).catch(() => {});
            }
          }
        })
        .catch(() => {});
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
              const uId = typeof act.userId === 'object' && act.userId ? (act.userId as any)._id : act.userId;
              const uName = typeof act.userId === 'object' && act.userId ? (act.userId as any).name : '';
              const uEmail = typeof act.userId === 'object' && act.userId ? (act.userId as any).email : '';
              const cleanAgentId = agentId.toLowerCase().trim();
              const match =
                (uId && String(uId).toLowerCase() === cleanAgentId) ||
                (uName && String(uName).toLowerCase() === cleanAgentId) ||
                (uEmail && String(uEmail).toLowerCase() === cleanAgentId) ||
                (act.agentId && String(act.agentId).toLowerCase() === cleanAgentId) ||
                (act.agentName && String(act.agentName).toLowerCase() === cleanAgentId);
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
      connected: false,
      stage: 'Dialing',
      tag: 'WARM',
      temperature: 'WARM',
      durationSeconds: 0,
      remark: 'Agent opened phone dialer',
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
      type: data.type || 'UPDATE',
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

    // Check if there is an existing auto-logged call for this lead created within 3 minutes
    const recentAutoIndex = existingForLead.findIndex((a) => {
      if (a.type !== 'CALL') return false;
      const ageMs = Date.now() - new Date(a.createdAt).getTime();
      return (
        ageMs < 180000 &&
        (a.remark === 'Call completed' ||
          a.remark === 'Call not answered' ||
          a.remark === 'Agent opened phone dialer' ||
          a.stage === 'Dialing')
      );
    });

    let updatedLeadActivities: Activity[];
    let resultingActivity: Activity;

    const isDispositionUpdate =
      recentAutoIndex >= 0 &&
      data.remark &&
      data.remark !== 'Call completed' &&
      data.remark !== 'Call not answered' &&
      data.remark !== 'Agent opened phone dialer';

    if (isDispositionUpdate) {
      const existing = existingForLead[recentAutoIndex];
      resultingActivity = {
        ...existing,
        stage: data.stage || existing.stage,
        tag: data.tag || data.temperature || existing.tag,
        temperature: (data.temperature || data.tag || existing.temperature) as any,
        remark: data.remark || existing.remark,
        followUpAt: data.followUpAt !== undefined ? data.followUpAt : existing.followUpAt,
        durationSeconds:
          data.durationSeconds && data.durationSeconds > 0
            ? data.durationSeconds
            : existing.durationSeconds,
        updatedAt: new Date().toISOString(),
      };
      updatedLeadActivities = [...existingForLead];
      updatedLeadActivities[recentAutoIndex] = resultingActivity;
    } else {
      resultingActivity = newActivity;
      updatedLeadActivities = [newActivity, ...existingForLead];
    }

    const updatedMap: Record<string, Activity[]> = {
      ...currentMap,
      [leadId]: updatedLeadActivities,
    };

    if (normPhone) {
      const existingForPhone = currentMap[normPhone] || [];
      const updatedPhoneActivities = isDispositionUpdate
        ? existingForPhone.map((a) => (a._id === resultingActivity._id ? resultingActivity : a))
        : [resultingActivity, ...existingForPhone.filter((a) => a._id !== resultingActivity._id)];
      updatedMap[normPhone] = updatedPhoneActivities;
      updatedMap[`phone_${normPhone}`] = updatedPhoneActivities;
    }

    set({ historyMap: updatedMap });

    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedMap)).catch(() => {});

    return resultingActivity;
  },

  updateLeadName: (leadId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const currentMap = { ...get().historyMap };
    let changed = false;
    for (const key of Object.keys(currentMap)) {
      currentMap[key] = currentMap[key].map((act) => {
        if (act.leadId === leadId || key === leadId) {
          changed = true;
          return { ...act, customerName: trimmed };
        }
        return act;
      });
    }
    if (changed) {
      set({ historyMap: currentMap });
      storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(currentMap)).catch(() => {});
    }
  },
}));
