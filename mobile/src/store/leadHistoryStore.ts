import { create } from 'zustand';
import { Activity, User } from '../types';
import { storage } from '../utils/storage';

const HISTORY_STORAGE_KEY = 'tele_crm_lead_history_v2';

export const normalizePhone = (phone?: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

// Pre-seeded multi-agent activities so testing immediately shows agent & branch timelines
const DEMO_ACTIVITIES_9810000129: Activity[] = [
  // 1. Most recent call by John (Agent - Pudukkottai Branch)
  {
    _id: 'act-john-9810000129',
    leadId: 'lead-2',
    phone: '9810000129',
    customerName: 'Priya Verma',
    branch: 'Pudukkottai',
    campaignId: 'camp-1',
    userId: {
      _id: 'u-john',
      name: 'John',
      email: 'john@company.com',
      phone: '9876543210',
      role: 'AGENT',
      branch: 'Pudukkottai',
      isActive: true,
      canReceiveLeads: true,
      createdAt: '',
      updatedAt: '',
    },
    type: 'CALL',
    connected: true,
    stage: 'Follow-up',
    tag: 'WARM',
    temperature: 'WARM',
    remark:
      'Follow-up call completed from Pudukkottai branch. Customer confirmed brochure received on WhatsApp. Requested custom price quote for 5 licenses. Scheduled closing call for tomorrow 11:00 AM.',
    followUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    durationSeconds: 142,
    answers: [],
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hr ago
    updatedAt: new Date().toISOString(),
  },
  // 2. Initial call by Kavin (Agent - Trichy Branch)
  {
    _id: 'act-kavin-9810000129',
    leadId: 'lead-2',
    phone: '9810000129',
    customerName: 'Priya Verma',
    branch: 'Trichy',
    campaignId: 'camp-1',
    userId: {
      _id: 'u-kavin',
      name: 'Kavin',
      email: 'kavin@company.com',
      phone: '9876543220',
      role: 'AGENT',
      branch: 'Trichy',
      isActive: true,
      canReceiveLeads: true,
      createdAt: '',
      updatedAt: '',
    },
    type: 'CALL',
    connected: true,
    stage: 'Interested',
    tag: 'HOT',
    temperature: 'HOT',
    remark:
      'Spoke with customer Priya. Explained Trichy branch services & telecalling features. Sent WhatsApp pricing brochure. Customer showed high interest! Handed over for Pudukkottai coordination.',
    followUpAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    durationSeconds: 195,
    answers: [],
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hrs ago
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_DEMO_HISTORIES: Record<string, Activity[]> = {
  // Rohan Mehta
  'lead-1': [
    {
      _id: 'act-101',
      leadId: 'lead-1',
      phone: '9810000081',
      customerName: 'Rohan Mehta',
      branch: 'Trichy',
      campaignId: 'camp-1',
      userId: {
        _id: 'u-kavin',
        name: 'Kavin',
        email: 'kavin@company.com',
        phone: '9876543220',
        role: 'AGENT',
        branch: 'Trichy',
        isActive: true,
        canReceiveLeads: true,
        createdAt: '',
        updatedAt: '',
      },
      type: 'CALL',
      connected: true,
      stage: 'Interested',
      tag: 'HOT',
      temperature: 'HOT',
      remark:
        'Customer wants complete Telecalling CRM setup for 10 agents. Sent WhatsApp brochure. Wants confirmation call tomorrow morning 10 AM.',
      followUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      durationSeconds: 154,
      answers: [],
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: 'act-102',
      leadId: 'lead-1',
      phone: '9810000081',
      customerName: 'Rohan Mehta',
      branch: 'Trichy',
      campaignId: 'camp-1',
      userId: {
        _id: 'u-sarah',
        name: 'Sarah Telecaller',
        email: 'sarah@company.com',
        phone: '9876543211',
        role: 'AGENT',
        branch: 'Trichy',
        isActive: true,
        canReceiveLeads: true,
        createdAt: '',
        updatedAt: '',
      },
      type: 'CALL',
      connected: false,
      notConnectedReason: 'BUSY',
      stage: 'Follow-up',
      tag: 'WARM',
      temperature: 'WARM',
      remark: 'Line was busy on initial call attempt. Re-scheduled retry.',
      followUpAt: null,
      durationSeconds: 15,
      answers: [],
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],

  // Priya Verma - 9810000129 (Pre-seeded with both Kavin from Trichy & John from Pudukkottai)
  '6ac623d96c84a3753e4573ff': DEMO_ACTIVITIES_9810000129,
  'lead-2': DEMO_ACTIVITIES_9810000129,
  'fu-2': DEMO_ACTIVITIES_9810000129,
  '9810000129': DEMO_ACTIVITIES_9810000129,
  phone_9810000129: DEMO_ACTIVITIES_9810000129,

  // Ayaan Patel
  'lead-5': [
    {
      _id: 'act-501',
      leadId: 'lead-5',
      phone: '9810000062',
      customerName: 'Ayaan Patel',
      branch: 'Pudukkottai',
      campaignId: 'camp-1',
      userId: {
        _id: 'u-john',
        name: 'John',
        email: 'john@company.com',
        phone: '9876543210',
        role: 'AGENT',
        branch: 'Pudukkottai',
        isActive: true,
        canReceiveLeads: true,
        createdAt: '',
        updatedAt: '',
      },
      type: 'CALL',
      connected: true,
      stage: 'Interested',
      tag: 'HOT',
      temperature: 'HOT',
      remark:
        'High buying intent! Ready to start pilot batch next Monday. Call scheduled for tomorrow 3 PM to finalize agreement.',
      followUpAt: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
      durationSeconds: 240,
      answers: [],
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],

  // Rohit Verma
  'lead-7': [
    {
      _id: 'act-701',
      leadId: 'lead-7',
      phone: '9810000099',
      customerName: 'Rohit Verma',
      branch: 'Trichy',
      campaignId: 'camp-1',
      userId: {
        _id: 'u-sarah',
        name: 'Sarah Telecaller',
        email: 'sarah@company.com',
        phone: '9876543211',
        role: 'AGENT',
        branch: 'Trichy',
        isActive: true,
        canReceiveLeads: true,
        createdAt: '',
        updatedAt: '',
      },
      type: 'CALL',
      connected: false,
      notConnectedReason: 'DID_NOT_PICK',
      stage: 'Not connected',
      tag: 'COLD',
      temperature: 'COLD',
      remark: 'Ringing did not answer. Automatic retry rule triggered.',
      followUpAt: null,
      durationSeconds: 25,
      answers: [],
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

interface LeadHistoryStore {
  historyMap: Record<string, Activity[]>;
  isLoaded: boolean;
  loadHistory: () => Promise<void>;
  getHistoryForLead: (leadId: string, phone?: string) => Activity[];
  getAllActivities: (agentId?: string) => Activity[];
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
  historyMap: INITIAL_DEMO_HISTORIES,
  isLoaded: false,

  loadHistory: async () => {
    try {
      const stored = await storage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({
          historyMap: { ...INITIAL_DEMO_HISTORIES, ...parsed },
          isLoaded: true,
        });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
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
              if (uId && uId !== agentId) continue;
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

    // 1. Check direct leadId
    addList(map[leadId]);

    // 2. Check fu- / lead- prefixes
    if (leadId.startsWith('fu-')) {
      addList(map[leadId.replace('fu-', 'lead-')]);
    } else if (leadId.startsWith('lead-')) {
      addList(map[leadId.replace('lead-', 'fu-')]);
    }

    // 3. Check normalized phone keys
    if (normPhone) {
      addList(map[normPhone]);
      addList(map[`phone_${normPhone}`]);
      addList(map[`+91${normPhone}`]);
    }

    // 4. Scan all records to find activities matching normalized phone
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

  addActivity: (leadId: string, data) => {
    const currentMap = get().historyMap;
    const agentName = data.agentName || 'John';
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

    // Append to leadId list
    const existingForLead = currentMap[leadId] || [];
    const updatedLeadActivities = [newActivity, ...existingForLead];

    const updatedMap: Record<string, Activity[]> = {
      ...currentMap,
      [leadId]: updatedLeadActivities,
    };

    // If phone number provided, also update phone keys so other agents find it immediately
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

    // Persist async
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedMap)).catch(() => {});

    return newActivity;
  },
}));
