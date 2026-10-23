import { create } from 'zustand';

interface DialerState {
  isOpen: boolean;
  phoneNumber: string;
  customerName: string;
  campaignId: string | null;
  openDialer: (phone?: string, name?: string, campaignId?: string | null) => void;
  closeDialer: () => void;
  setPhoneNumber: (phone: string) => void;
  setCustomerName: (name: string) => void;
  setCampaignId: (id: string | null) => void;
  appendDigit: (digit: string) => void;
  backspace: () => void;
  clear: () => void;
}

export const useDialerStore = create<DialerState>((set) => ({
  isOpen: false,
  phoneNumber: '',
  customerName: '',
  campaignId: null,
  openDialer: (phone = '', name = '', campaignId = null) =>
    set({
      isOpen: true,
      phoneNumber: phone,
      customerName: name,
      campaignId,
    }),
  closeDialer: () => set({ isOpen: false }),
  setPhoneNumber: (phoneNumber) => set({ phoneNumber }),
  setCustomerName: (customerName) => set({ customerName }),
  setCampaignId: (campaignId) => set({ campaignId }),
  appendDigit: (digit) =>
    set((state) => {
      if (state.phoneNumber.length >= 15) return state;
      return { phoneNumber: state.phoneNumber + digit };
    }),
  backspace: () =>
    set((state) => ({
      phoneNumber: state.phoneNumber.slice(0, -1),
    })),
  clear: () => set({ phoneNumber: '', customerName: '' }),
}));
