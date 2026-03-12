import { create } from "zustand";

type AppState = {
  // Mobile UI state (not recipe-specific)
  mobileSearchOpen: boolean;
  setMobileSearchOpen: (open: boolean) => void;
};

export const useAppStore = create<AppState>()((set) => ({
  mobileSearchOpen: false,
  setMobileSearchOpen: (mobileSearchOpen: boolean) => set({ mobileSearchOpen }),
}));
