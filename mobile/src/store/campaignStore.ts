import { create } from 'zustand';
import { storage } from '../utils/storage';

interface CampaignState {
  selectedCampaignId: string | null;
  selectedCampaignName: string;
  setSelectedCampaign: (id: string | null, name: string) => Promise<void>;
  restoreCampaignSelection: () => Promise<void>;
  clearCampaign: () => Promise<void>;
}

const CAMPAIGN_ID_KEY = 'tele_selected_campaign_id';
const CAMPAIGN_NAME_KEY = 'tele_selected_campaign_name';

export const useCampaignStore = create<CampaignState>((set) => ({
  selectedCampaignId: null,
  selectedCampaignName: 'All campaigns',

  setSelectedCampaign: async (id: string | null, name: string) => {
    set({ selectedCampaignId: id, selectedCampaignName: name });
    if (id) {
      await storage.setItem(CAMPAIGN_ID_KEY, id);
      await storage.setItem(CAMPAIGN_NAME_KEY, name);
    } else {
      await storage.removeItem(CAMPAIGN_ID_KEY);
      await storage.setItem(CAMPAIGN_NAME_KEY, 'All campaigns');
    }
  },

  restoreCampaignSelection: async () => {
    try {
      const id = await storage.getItem(CAMPAIGN_ID_KEY);
      const name = await storage.getItem(CAMPAIGN_NAME_KEY);
      if (id && name) {
        set({ selectedCampaignId: id, selectedCampaignName: name });
      }
    } catch {
      // ignore
    }
  },

  clearCampaign: async () => {
    await storage.removeItem(CAMPAIGN_ID_KEY);
    await storage.setItem(CAMPAIGN_NAME_KEY, 'All campaigns');
    set({ selectedCampaignId: null, selectedCampaignName: 'All campaigns' });
  },
}));
