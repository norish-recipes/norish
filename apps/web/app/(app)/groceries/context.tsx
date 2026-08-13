"use client";

import type { GroceryGroupSimilar, GroceryViewMode } from "@/lib/grocery-preferences";
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useDevicePreferenceState } from "@/context/device-preference-context";
import {
  useGroceriesMutations,
  useGroceriesQuery,
  useGroceriesSubscription,
} from "@/hooks/groceries";
import {
  groceryGroupSimilarPreference,
  groceryViewModePreference,
} from "@/lib/grocery-preferences";

import type { GroceryDto } from "@norish/shared/contracts";
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

export type { GroceryViewMode } from "@/lib/grocery-preferences";

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
  /** The cookies as the server read them; absent on the offline bootstrap. */
  initialViewMode?: GroceryViewMode;
  initialGroupSimilar?: GroceryGroupSimilar;
};

function GroceriesUiProvider({
  children,
  initialViewMode,
  initialGroupSimilar,
}: GroceriesUiProviderProps) {
  // UI State
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);
  const [recurrencePanelGroceryId, setRecurrencePanelGroceryId] = useState<string | null>(null);
  const [addGroceryPanelOpen, setAddGroceryPanelOpen] = useState(false);
  const [editingGrocery, setEditingGrocery] = useState<GroceryDto | null>(null);

  // Both device preferences ride cookies so the server renders the page the
  // way the reader left it; the shared state covers the seeded, self-read
  // and stale-HTML reconcile paths.
  const [viewMode, setViewMode] = useDevicePreferenceState(
    groceryViewModePreference,
    initialViewMode
  );

  const [groupSimilarValue, setGroupSimilarValue] = useDevicePreferenceState(
    groceryGroupSimilarPreference,
    initialGroupSimilar
  );

  const groupSimilarIngredients = groupSimilarValue === "true";

  const setGroupSimilarIngredients = useCallback(
    (enabled: boolean) => setGroupSimilarValue(enabled ? "true" : "false"),
    [setGroupSimilarValue]
  );

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

export function GroceriesContextProvider({
  children,
  initialViewMode,
  initialGroupSimilar,
}: GroceriesUiProviderProps) {
  return (
    <GroceriesProvider>
      <GroceriesUiProvider
        initialGroupSimilar={initialGroupSimilar}
        initialViewMode={initialViewMode}
      >
        {children}
      </GroceriesUiProvider>
    </GroceriesProvider>
  );
}
