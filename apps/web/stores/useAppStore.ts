import { create } from "zustand";

type AppState = {
  // Mobile UI state (not recipe-specific)
  mobileSearchOpen: boolean;
  setMobileSearchOpen: (open: boolean) => void;
  /** An action bar is up, and takes the place of the mobile nav and the Library pill. */
  actionBarOpen: boolean;
  setActionBarOpen: (open: boolean) => void;
};

export const useAppStore = create<AppState>()((set) => ({
  mobileSearchOpen: false,
  setMobileSearchOpen: (mobileSearchOpen: boolean) => set({ mobileSearchOpen }),
  actionBarOpen: false,
  setActionBarOpen: (actionBarOpen: boolean) => set({ actionBarOpen }),
}));
