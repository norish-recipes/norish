"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import {
  useGroceriesMutations,
  useGroceriesQuery,
  useGroceriesSubscription,
} from "@/hooks/groceries";
import { useLocalStorage } from "@/hooks/use-local-storage";

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

// =============================================================================
// View Mode Types
// =============================================================================

export type GroceryViewMode = "store" | "recipe";

const GROCERY_VIEW_MODE_KEY = "norish:grocery-view-mode";
const GROCERY_GROUP_SIMILAR_KEY = "norish:grocery-group-similar";

// Validation function defined outside component to prevent re-renders
function validateViewMode(data: unknown): GroceryViewMode | null {
  return data === "store" || data === "recipe" ? data : null;
}

// Validation function for group similar toggle
function validateGroupSimilar(data: unknown): boolean | null {
  return typeof data === "boolean" ? data : null;
}

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

function GroceriesUiProvider({ children }: { children: ReactNode }) {
  // UI State
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);
  const [recurrencePanelGroceryId, setRecurrencePanelGroceryId] = useState<string | null>(null);
  const [addGroceryPanelOpen, setAddGroceryPanelOpen] = useState(false);
  const [editingGrocery, setEditingGrocery] = useState<GroceryDto | null>(null);

  // View mode with localStorage persistence
  const [viewMode, setViewMode] = useLocalStorage<GroceryViewMode>(
    GROCERY_VIEW_MODE_KEY,
    "store",
    validateViewMode
  );

  // Group similar ingredients toggle (only for store view)
  const [groupSimilarIngredients, setGroupSimilarIngredients] = useLocalStorage<boolean>(
    GROCERY_GROUP_SIMILAR_KEY,
    true,
    validateGroupSimilar
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

export function GroceriesContextProvider({ children }: { children: ReactNode }) {
  return (
    <GroceriesProvider>
      <GroceriesUiProvider>{children}</GroceriesUiProvider>
    </GroceriesProvider>
  );
}
