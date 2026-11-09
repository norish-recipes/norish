"use client";

import { createContext, ReactNode, use, useCallback, useMemo, useState } from "react";

import type { GroceryDto } from "@norish/shared/contracts";
import type { GroceryViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { useDevicePreference } from "@norish/shared-react/reader";

export type { GroceryViewMode } from "@norish/shared/contracts/zod/device-preferences";

type GroceriesUiContextValue = {
  recurrencePanelOpen: boolean;
  recurrencePanelGroceryId: string | null;
  openRecurrencePanel: (groceryId: string) => void;
  closeRecurrencePanel: () => void;
  addGroceryPanelOpen: boolean;
  setAddGroceryPanelOpen: (open: boolean) => void;
  editingGrocery: GroceryDto | null;
  setEditingGrocery: (grocery: GroceryDto | null) => void;
  // View mode
  viewMode: GroceryViewMode;
  setViewMode: (mode: GroceryViewMode) => void;
  // Group similar ingredients (only applicable in store view)
  groupSimilarIngredients: boolean;
  setGroupSimilarIngredients: (enabled: boolean) => void;
  storeManagerOpen: boolean;
  setStoreManagerOpen: (open: boolean) => void;
};

const GroceriesUiContext = createContext<GroceriesUiContextValue | null>(null);

type GroceriesUiProviderProps = {
  children: ReactNode;
};

/** The groceries screen's UI state; its server data is read through `@norish/shared-react/groceries`. */
export function GroceriesUiProvider({ children }: GroceriesUiProviderProps) {
  // UI State
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);
  const [recurrencePanelGroceryId, setRecurrencePanelGroceryId] = useState<string | null>(null);
  const [addGroceryPanelOpen, setAddGroceryPanelOpen] = useState(false);
  const [editingGrocery, setEditingGrocery] = useState<GroceryDto | null>(null);
  const [storeManagerOpen, setStoreManagerOpen] = useState(false);

  // Device Preferences: the server renders the page the way the reader left it.
  const [viewMode, setViewMode] = useDevicePreference("groceryViewMode");
  const [groupSimilarIngredients, setGroupSimilarIngredients] =
    useDevicePreference("groceryGroupSimilar");

  const openRecurrencePanel = useCallback((groceryId: string) => {
    setRecurrencePanelGroceryId(groceryId);
    setRecurrencePanelOpen(true);
  }, []);

  const closeRecurrencePanel = useCallback(() => {
    setRecurrencePanelOpen(false);
    setRecurrencePanelGroceryId(null);
  }, []);

  // UI context value
  const uiValue = useMemo<GroceriesUiContextValue>(
    () => ({
      recurrencePanelOpen,
      recurrencePanelGroceryId,
      openRecurrencePanel,
      closeRecurrencePanel,
      addGroceryPanelOpen,
      setAddGroceryPanelOpen,
      editingGrocery,
      setEditingGrocery,
      viewMode,
      setViewMode,
      groupSimilarIngredients,
      setGroupSimilarIngredients,
      storeManagerOpen,
      setStoreManagerOpen,
    }),
    [
      recurrencePanelOpen,
      recurrencePanelGroceryId,
      openRecurrencePanel,
      closeRecurrencePanel,
      addGroceryPanelOpen,
      editingGrocery,
      setEditingGrocery,
      viewMode,
      setViewMode,
      groupSimilarIngredients,
      setGroupSimilarIngredients,
      storeManagerOpen,
    ]
  );

  return <GroceriesUiContext value={uiValue}>{children}</GroceriesUiContext>;
}

export function useGroceriesUiContext() {
  const ctx = use(GroceriesUiContext);

  if (!ctx) throw new Error("useGroceriesUiContext must be used within GroceriesUiProvider");

  return ctx;
}
