"use client";

import type { GroceryDto, RecurringGroceryDto } from "@/types";
import type { RecurrencePattern } from "@/types/recurrence";

import { createContext, useContext, ReactNode, useMemo, useCallback, useState } from "react";

import {
  useGroceriesQuery,
  useGroceriesMutations,
  useGroceriesSubscription,
} from "@/hooks/groceries";

// =============================================================================
// Data Context
// =============================================================================

type DataCtx = {
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  doneGroceries: GroceryDto[];
  pendingGroceries: GroceryDto[];
  isLoading: boolean;

  // Grocery Actions
  createGrocery: (raw: string, storeId?: string | null) => void;
  createRecurringGrocery: (raw: string, pattern: RecurrencePattern, storeId?: string | null) => void;
  toggleGroceries: (ids: string[], isDone: boolean) => void;
  toggleRecurringGrocery: (recurringGroceryId: string, groceryId: string, isDone: boolean) => void;
  updateGrocery: (id: string, updatedText: string) => void;
  updateRecurringGrocery: (
    recurringGroceryId: string,
    groceryId: string,
    raw: string,
    pattern: RecurrencePattern | null
  ) => void;
  deleteGroceries: (ids: string[]) => void;
  deleteRecurringGrocery: (recurringGroceryId: string) => void;
  getRecurringGroceryForGrocery: (groceryId: string) => RecurringGroceryDto | null;
  assignGroceryToStore: (groceryId: string, storeId: string | null, savePreference?: boolean) => void;
  reorderGroceriesInStore: (updates: { id: string; sortOrder: number }[], backendOnly?: boolean) => void;
  markAllDoneInStore: (storeId: string | null) => void;
  deleteDoneInStore: (storeId: string | null) => void;
};

const GroceriesContext = createContext<DataCtx | null>(null);

// =============================================================================
// UI Context
// =============================================================================

type UICtx = {
  recurrencePanelOpen: boolean;
  recurrencePanelGroceryId: string | null;
  openRecurrencePanel: (groceryId: string) => void;
  closeRecurrencePanel: () => void;
  addGroceryPanelOpen: boolean;
  setAddGroceryPanelOpen: (open: boolean) => void;
  editingGrocery: GroceryDto | null;
  setEditingGrocery: (grocery: GroceryDto | null) => void;
};

const GroceriesUIContext = createContext<UICtx | null>(null);

// =============================================================================
// Provider
// =============================================================================

export function GroceriesContextProvider({ children }: { children: ReactNode }) {
  // Data hooks
  const { groceries, recurringGroceries, isLoading } = useGroceriesQuery();
  const groceryMutations = useGroceriesMutations();

  // Subscribe to WebSocket events (updates query cache)
  useGroceriesSubscription();

  // UI State
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);
  const [recurrencePanelGroceryId, setRecurrencePanelGroceryId] = useState<string | null>(null);
  const [addGroceryPanelOpen, setAddGroceryPanelOpen] = useState(false);
  const [editingGrocery, setEditingGrocery] = useState<GroceryDto | null>(null);

  const openRecurrencePanel = useCallback((groceryId: string) => {
    setRecurrencePanelGroceryId(groceryId);
    setRecurrencePanelOpen(true);
  }, []);

  const closeRecurrencePanel = useCallback(() => {
    setRecurrencePanelOpen(false);
    setRecurrencePanelGroceryId(null);
  }, []);

  // Computed: split groceries into done and pending
  const doneGroceries = useMemo(
    () => groceries.filter((g) => g.isDone && !g.recurringGroceryId),
    [groceries]
  );

  const pendingGroceries = useMemo(() => {
    const unchecked = groceries.filter((g) => !g.isDone);
    const checkedRecurring = groceries.filter((g) => g.isDone && g.recurringGroceryId);

    // Sort checked recurring by nextPlannedFor date
    const sortedChecked = [...checkedRecurring].sort((a, b) => {
      const recurringA = recurringGroceries.find((r) => r.id === a.recurringGroceryId);
      const recurringB = recurringGroceries.find((r) => r.id === b.recurringGroceryId);

      if (!recurringA || !recurringB) return 0;

      return recurringA.nextPlannedFor.localeCompare(recurringB.nextPlannedFor);
    });

    return [...unchecked, ...sortedChecked];
  }, [groceries, recurringGroceries]);

  // Data context value
  const dataValue = useMemo<DataCtx>(
    () => ({
      groceries,
      recurringGroceries,
      doneGroceries,
      pendingGroceries,
      isLoading,
      ...groceryMutations,
    }),
    [groceries, recurringGroceries, doneGroceries, pendingGroceries, isLoading, groceryMutations]
  );

  // UI context value
  const uiValue = useMemo<UICtx>(
    () => ({
      recurrencePanelOpen,
      recurrencePanelGroceryId,
      openRecurrencePanel,
      closeRecurrencePanel,
      addGroceryPanelOpen,
      setAddGroceryPanelOpen,
      editingGrocery,
      setEditingGrocery,
    }),
    [recurrencePanelOpen, recurrencePanelGroceryId, openRecurrencePanel, closeRecurrencePanel, addGroceryPanelOpen, editingGrocery]
  );

  return (
    <GroceriesContext.Provider value={dataValue}>
      <GroceriesUIContext.Provider value={uiValue}>{children}</GroceriesUIContext.Provider>
    </GroceriesContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

export function useGroceriesContext() {
  const ctx = useContext(GroceriesContext);

  if (!ctx) throw new Error("useGroceriesContext must be used within GroceriesContextProvider");

  return ctx;
}

export function useGroceriesUIContext() {
  const ctx = useContext(GroceriesUIContext);

  if (!ctx) throw new Error("useGroceriesUIContext must be used within GroceriesContextProvider");

  return ctx;
}
