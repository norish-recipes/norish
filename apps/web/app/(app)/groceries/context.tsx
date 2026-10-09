"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useDevicePreference } from "@/context/device-preferences-context";
import {
  useGroceriesMutations,
  useGroceriesQuery,
  useGroceriesSubscription,
} from "@/hooks/groceries";

import type { GroceryDto } from "@norish/shared/contracts";
import type { GroceryViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { createGroceriesContext } from "@norish/shared-react/contexts";

// =============================================================================
// Shared Data Context (from factory)
// =============================================================================

const sharedGroceriesContext = createGroceriesContext({
  useGroceriesQuery,
  useGroceriesMutations,
  useGroceriesSubscription,
});

export const GroceriesProvider = sharedGroceriesContext.GroceriesProvider;
export const useGroceriesContext = sharedGroceriesContext.useGroceriesContext;

export type { GroceryViewMode } from "@norish/shared/contracts/zod/device-preferences";

// =============================================================================
// Web-only UI Context
// =============================================================================

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
};

const GroceriesUiCtx = createContext<GroceriesUiContextValue | null>(null);

type GroceriesUiProviderProps = {
  children: ReactNode;
};

function GroceriesUiProvider({ children }: GroceriesUiProviderProps) {
  // UI State
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);
  const [recurrencePanelGroceryId, setRecurrencePanelGroceryId] = useState<string | null>(null);
  const [addGroceryPanelOpen, setAddGroceryPanelOpen] = useState(false);
  const [editingGrocery, setEditingGrocery] = useState<GroceryDto | null>(null);

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
    ]
  );

  return <GroceriesUiCtx.Provider value={uiValue}>{children}</GroceriesUiCtx.Provider>;
}

export function useGroceriesUiContext() {
  const ctx = useContext(GroceriesUiCtx);

  if (!ctx) throw new Error("useGroceriesUiContext must be used within GroceriesContextProvider");

  return ctx;
}

// =============================================================================
// Combined Provider
// =============================================================================

export function GroceriesContextProvider({ children }: GroceriesUiProviderProps) {
  return (
    <GroceriesProvider>
      <GroceriesUiProvider>{children}</GroceriesUiProvider>
    </GroceriesProvider>
  );
}
