import { create } from 'zustand';
import { storage } from '../utils/storage';

const STORAGE_KEY = 'okboz_whatsapp_templates';

export interface WhatsAppTemplate {
  id: string;
  title: string;
  content: string;
  category?: string;
  isDefault?: boolean;
}

export const INITIAL_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tmpl-services',
    title: 'Our Services Overview',
    category: 'Services',
    isDefault: true,
    content:
      'Hello {name},\n\nThank you for speaking with us today! As discussed, here is a quick overview of our core services:\n\n✨ Complete Business Solutions\n✨ Telecalling & Lead Management\n✨ Customer Relationship Outreach\n✨ Dedicated 24/7 Account Support\n\nPlease let us know when would be a convenient time to discuss your requirements. Have a wonderful day!',
  },
  {
    id: 'tmpl-packages',
    title: 'Service Packages & Pricing',
    category: 'Pricing',
    isDefault: true,
    content:
      'Hi {name},\n\nFollowing up on our phone conversation, here are our service packages:\n\n📌 Starter Outreach Plan: Perfect for small teams\n📌 Growth CRM Plan: Advanced reporting & automated dialing\n📌 Enterprise Scale: Dedicated manager & full customization\n\nFeel free to reply here if you have any questions or would like to schedule a quick walkthrough!',
  },
  {
    id: 'tmpl-followup',
    title: 'Follow-up Call Confirmation',
    category: 'Follow-up',
    isDefault: true,
    content:
      'Hi {name},\n\nConfirming our scheduled discussion as agreed on our call today. Looking forward to connecting with you!\n\nPlease let us know if you need to reschedule or require any details beforehand.',
  },
  {
    id: 'tmpl-contact',
    title: 'Company Details & Brochure',
    category: 'Contact',
    isDefault: true,
    content:
      'Dear {name},\n\nThank you for your interest in our services! You can reach us directly on this WhatsApp number or reply to this chat anytime.\n\nWe look forward to partnering with you!',
  },
];

interface TemplateState {
  templates: WhatsAppTemplate[];
  isLoading: boolean;
  loadTemplates: () => Promise<void>;
  addTemplate: (title: string, content: string, category?: string) => Promise<void>;
  updateTemplate: (id: string, title: string, content: string, category?: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: INITIAL_TEMPLATES,
  isLoading: false,

  loadTemplates: async () => {
    try {
      set({ isLoading: true });
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({ templates: parsed, isLoading: false });
          return;
        }
      }
      // If none saved, use defaults
      await storage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TEMPLATES));
      set({ templates: INITIAL_TEMPLATES, isLoading: false });
    } catch {
      set({ templates: INITIAL_TEMPLATES, isLoading: false });
    }
  },

  addTemplate: async (title: string, content: string, category: string = 'Custom') => {
    const newTemplate: WhatsAppTemplate = {
      id: `tmpl-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      category,
      isDefault: false,
    };
    const updated = [newTemplate, ...get().templates];
    set({ templates: updated });
    await storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  updateTemplate: async (id: string, title: string, content: string, category?: string) => {
    const updated = get().templates.map((t) =>
      t.id === id
        ? {
            ...t,
            title: title.trim(),
            content: content.trim(),
            category: category || t.category,
          }
        : t,
    );
    set({ templates: updated });
    await storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  deleteTemplate: async (id: string) => {
    const updated = get().templates.filter((t) => t.id !== id);
    set({ templates: updated });
    await storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  resetToDefaults: async () => {
    set({ templates: INITIAL_TEMPLATES });
    await storage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TEMPLATES));
  },
}));
