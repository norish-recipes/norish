import { create } from "zustand";

type ActionBarState = {
  /** An action bar is up, and takes the place of the mobile nav and the Library pill. */
  actionBarOpen: boolean;
  setActionBarOpen: (open: boolean) => void;
};

export const useActionBarStore = create<ActionBarState>()((set) => ({
  actionBarOpen: false,
  setActionBarOpen: (actionBarOpen) => set({ actionBarOpen }),
}));
