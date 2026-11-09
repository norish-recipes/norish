import { create } from "zustand";

import type { GroceryDto } from "@norish/shared/contracts";

interface GroceriesUiState {
  addGroceryPanelOpen: boolean;
  /** The grocery the edit panel shows; null while it is closed. */
  editingGrocery: GroceryDto | null;
  storeManagerOpen: boolean;
  setAddGroceryPanelOpen: (open: boolean) => void;
  setEditingGrocery: (grocery: GroceryDto | null) => void;
  setStoreManagerOpen: (open: boolean) => void;
  /** Every panel closed, for the screen's next visit. */
  reset: () => void;
}

const CLOSED = { addGroceryPanelOpen: false, editingGrocery: null, storeManagerOpen: false };

/** The groceries screen's panels. Global, so the screen resets it as it unmounts. */
export const useGroceriesUiStore = create<GroceriesUiState>()((set) => ({
  ...CLOSED,
  setAddGroceryPanelOpen: (addGroceryPanelOpen) => set({ addGroceryPanelOpen }),
  setEditingGrocery: (editingGrocery) => set({ editingGrocery }),
  setStoreManagerOpen: (storeManagerOpen) => set({ storeManagerOpen }),
  reset: () => set(CLOSED),
}));
