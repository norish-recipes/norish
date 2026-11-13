import { create } from "zustand";

interface GroceriesUiState {
  addGroceryPanelOpen: boolean;
  /** The grocery the edit panel shows, read live from the list; null while it is closed. */
  editingGroceryId: string | null;
  storeManagerOpen: boolean;
  setAddGroceryPanelOpen: (open: boolean) => void;
  setEditingGroceryId: (groceryId: string | null) => void;
  setStoreManagerOpen: (open: boolean) => void;
  /** Every panel closed, for the screen's next visit. */
  reset: () => void;
}

const CLOSED = { addGroceryPanelOpen: false, editingGroceryId: null, storeManagerOpen: false };

/** The groceries screen's panels. Global, so the screen resets it as it unmounts. */
export const useGroceriesUiStore = create<GroceriesUiState>()((set) => ({
  ...CLOSED,
  setAddGroceryPanelOpen: (addGroceryPanelOpen) => set({ addGroceryPanelOpen }),
  setEditingGroceryId: (editingGroceryId) => set({ editingGroceryId }),
  setStoreManagerOpen: (storeManagerOpen) => set({ storeManagerOpen }),
  reset: () => set(CLOSED),
}));
