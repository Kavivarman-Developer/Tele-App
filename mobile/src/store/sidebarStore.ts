import { create } from 'zustand';

interface SidebarState {
  isCollapsed: boolean;
  isOpenMobileDrawer: boolean;
  currentRoute: string;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  setCurrentRoute: (route: string) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: false,
  isOpenMobileDrawer: false,
  currentRoute: 'Home',
  toggleCollapse: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setCollapsed: (collapsed: boolean) => set({ isCollapsed: collapsed }),
  openDrawer: () => set({ isOpenMobileDrawer: true }),
  closeDrawer: () => set({ isOpenMobileDrawer: false }),
  toggleDrawer: () => set((state) => ({ isOpenMobileDrawer: !state.isOpenMobileDrawer })),
  setCurrentRoute: (route: string) => set({ currentRoute: route }),
}));
