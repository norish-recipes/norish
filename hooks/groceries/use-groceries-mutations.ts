"use client";

import type { RecurringGroceryDto } from "@/types";
import type { RecurrencePattern } from "@/types/recurrence";

import { useMutation } from "@tanstack/react-query";

import { useGroceriesQuery } from "./use-groceries-query";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useUnitsQuery } from "@/hooks/config";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { calculateNextOccurrence, getTodayString } from "@/lib/recurrence/calculator";
import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("GroceriesMutations");

export type GroceryCreateData = {
  name: string;
  amount?: number | null;
  unit?: string | null;
  isDone?: boolean;
};

export type GroceriesMutationsResult = {
  createGrocery: (raw: string, storeId?: string | null) => void;
  createGroceriesFromData: (groceries: GroceryCreateData[]) => Promise<string[]>;
  createRecurringGrocery: (raw: string, pattern: RecurrencePattern, storeId?: string | null) => void;
  toggleGroceries: (ids: string[], isDone: boolean) => void;
  toggleRecurringGrocery: (recurringGroceryId: string, groceryId: string, isDone: boolean) => void;
  updateGrocery: (id: string, raw: string) => void;
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
  reorderGroceriesInStore: (updates: { id: string; sortOrder: number }[], updateBackend?: boolean) => void;
  markAllDoneInStore: (storeId: string | null) => void;
  deleteDoneInStore: (storeId: string | null) => void;
};

export function useGroceriesMutations(): GroceriesMutationsResult {
  const trpc = useTRPC();
  const { units } = useUnitsQuery();
  const { setGroceriesData, invalidate, groceries, recurringGroceries } = useGroceriesQuery();

  const createMutation = useMutation(trpc.groceries.create.mutationOptions());
  const toggleMutation = useMutation(trpc.groceries.toggle.mutationOptions());
  const updateMutation = useMutation(trpc.groceries.update.mutationOptions());
  const deleteMutation = useMutation(trpc.groceries.delete.mutationOptions());
  const createRecurringMutation = useMutation(trpc.groceries.createRecurring.mutationOptions());
  const updateRecurringMutation = useMutation(trpc.groceries.updateRecurring.mutationOptions());
  const deleteRecurringMutation = useMutation(trpc.groceries.deleteRecurring.mutationOptions());
  const checkRecurringMutation = useMutation(trpc.groceries.checkRecurring.mutationOptions());
  const markAllDoneMutation = useMutation(trpc.groceries.markAllDone.mutationOptions());
  const deleteDoneMutation = useMutation(trpc.groceries.deleteDone.mutationOptions());

  const createGrocery = (raw: string, storeId?: string | null) => {
    const parsed = parseIngredientWithDefaults(raw, units)[0];
    const groceryData = {
      name: parsed.description,
      amount: parsed.quantity,
      unit: parsed.unitOfMeasure,
      isDone: false,
      storeId: storeId ?? null,
    };

    // No optimistic update - websocket subscription will add with correct store
    createMutation.mutate([groceryData], {
      onError: () => invalidate(),
    });
  };

  const createGroceriesFromData = (groceryDataList: GroceryCreateData[]): Promise<string[]> => {
    const groceriesToCreate = groceryDataList.map((g) => ({
      name: g.name,
      amount: g.amount ?? null,
      unit: g.unit ?? null,
      isDone: g.isDone ?? false,
    }));

    return new Promise((resolve, reject) => {
      // No optimistic update - websocket subscription will add with correct store
      createMutation.mutate(groceriesToCreate, {
        onSuccess: (ids) => {
          resolve(ids);
        },
        onError: (error) => {
          invalidate();
          reject(error);
        },
      });
    });
  };

  const createRecurringGrocery = (raw: string, pattern: RecurrencePattern, storeId?: string | null): void => {
    const parsed = parseIngredientWithDefaults(raw, units)[0];
    const today = getTodayString();
    const nextDate = calculateNextOccurrence(pattern, today);

    // No optimistic update - websocket subscription will add with correct store
    createRecurringMutation.mutate(
      {
        name: parsed.description,
        amount: parsed.quantity ?? null,
        unit: parsed.unitOfMeasure,
        recurrenceRule: pattern.rule,
        recurrenceInterval: pattern.interval || 1,
        recurrenceWeekday: pattern.weekday ?? null,
        nextPlannedFor: nextDate,
        storeId: storeId ?? null,
      },
      {
        onError: () => invalidate(),
      }
    );
  };

  const toggleGroceries = (ids: string[], isDone: boolean) => {
    // Optimistic update
    setGroceriesData((prev) => {
      if (!prev) return prev;
      const updated = prev.groceries.map((g) => (ids.includes(g.id) ? { ...g, isDone } : g));

      return { ...prev, groceries: updated };
    });

    toggleMutation.mutate({ groceryIds: ids, isDone }, { onError: () => invalidate() });
  };

  const toggleRecurringGrocery = (
    recurringGroceryId: string,
    groceryId: string,
    isDone: boolean
  ) => {
    // Optimistic update
    setGroceriesData((prev) => {
      if (!prev) return prev;

      const updatedGroceries = prev.groceries.map((g) =>
        g.id === groceryId ? { ...g, isDone } : g
      );

      let updatedRecurringGroceries = prev.recurringGroceries;

      if (isDone) {
        const recurring = prev.recurringGroceries.find((r) => r.id === recurringGroceryId);

        if (recurring) {
          const today = getTodayString();
          const pattern = {
            rule: recurring.recurrenceRule as "day" | "week" | "month",
            interval: recurring.recurrenceInterval,
            weekday: recurring.recurrenceWeekday ?? undefined,
          };
          const nextDate = calculateNextOccurrence(
            pattern,
            recurring.nextPlannedFor,
            recurring.nextPlannedFor
          );

          updatedRecurringGroceries = prev.recurringGroceries.map((r) =>
            r.id === recurringGroceryId
              ? { ...r, nextPlannedFor: nextDate, lastCheckedDate: today }
              : r
          );
        }
      }

      return {
        ...prev,
        groceries: updatedGroceries,
        recurringGroceries: updatedRecurringGroceries,
      };
    });

    checkRecurringMutation.mutate(
      { recurringGroceryId, groceryId, isDone },
      { onError: () => invalidate() }
    );
  };

  const updateGrocery = (id: string, raw: string) => {
    const parsed = parseIngredientWithDefaults(raw, units)[0];

    // Optimistic update
    setGroceriesData((prev) => {
      if (!prev) return prev;
      const updated = prev.groceries.map((g) =>
        g.id === id
          ? { ...g, amount: parsed.quantity, unit: parsed.unitOfMeasure, name: parsed.description }
          : g
      );

      return { ...prev, groceries: updated };
    });

    updateMutation.mutate({ groceryId: id, raw }, { onError: () => invalidate() });
  };

  const updateRecurringGrocery = (
    recurringGroceryId: string,
    groceryId: string,
    raw: string,
    pattern: RecurrencePattern | null
  ) => {
    const parsed = parseIngredientWithDefaults(raw, units)[0];

    if (pattern) {
      const today = getTodayString();
      const nextDate = calculateNextOccurrence(pattern, today);

      // Optimistic update
      setGroceriesData((prev) => {
        if (!prev) return prev;

        return {
          groceries: prev.groceries.map((g) =>
            g.id === groceryId
              ? {
                  ...g,
                  amount: parsed.quantity,
                  unit: parsed.unitOfMeasure,
                  name: parsed.description,
                }
              : g
          ),
          recurringGroceries: prev.recurringGroceries.map((r) =>
            r.id === recurringGroceryId
              ? {
                  ...r,
                  name: parsed.description,
                  amount: parsed.quantity,
                  unit: parsed.unitOfMeasure,
                  recurrenceRule: pattern.rule,
                  recurrenceInterval: pattern.interval,
                  recurrenceWeekday: pattern.weekday ?? null,
                  nextPlannedFor: nextDate,
                }
              : r
          ),
        };
      });

      updateRecurringMutation.mutate(
        {
          recurringGroceryId,
          groceryId,
          data: {
            name: parsed.description,
            amount: parsed.quantity ?? null,
            unit: parsed.unitOfMeasure,
            recurrenceRule: pattern.rule,
            recurrenceInterval: pattern.interval,
            recurrenceWeekday: pattern.weekday ?? null,
            nextPlannedFor: nextDate,
          },
        },
        { onError: () => invalidate() }
      );
    } else {
      // Remove recurrence - convert to regular grocery
      setGroceriesData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          recurringGroceries: prev.recurringGroceries.filter((r) => r.id !== recurringGroceryId),
          groceries: prev.groceries.map((g) =>
            g.id === groceryId
              ? {
                  ...g,
                  amount: parsed.quantity,
                  unit: parsed.unitOfMeasure,
                  name: parsed.description,
                  recurringGroceryId: null,
                }
              : g
          ),
        };
      });

      deleteRecurringMutation.mutate({ recurringGroceryId }, { onError: () => invalidate() });
      updateMutation.mutate({ groceryId, raw }, { onError: () => invalidate() });
    }
  };

  const deleteGroceries = (ids: string[]) => {
    const idsSet = new Set(ids);

    // Optimistic update
    setGroceriesData((prev) => {
      if (!prev) return prev;

      return {
        groceries: prev.groceries.filter((g) => !idsSet.has(g.id)),
        recurringGroceries: prev.recurringGroceries,
      };
    });

    deleteMutation.mutate({ groceryIds: ids }, { onError: () => invalidate() });
  };

  const deleteRecurringGrocery = (recurringGroceryId: string) => {
    // Optimistic update
    setGroceriesData((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        recurringGroceries: prev.recurringGroceries.filter((r) => r.id !== recurringGroceryId),
        groceries: prev.groceries.filter((g) => g.recurringGroceryId !== recurringGroceryId),
      };
    });

    deleteRecurringMutation.mutate({ recurringGroceryId }, { onError: () => invalidate() });
  };

  const getRecurringGroceryForGrocery = (groceryId: string): RecurringGroceryDto | null => {
    const grocery = groceries.find((g) => g.id === groceryId);

    if (!grocery?.recurringGroceryId) return null;

    return recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) || null;
  };

  const assignToStoreMutation = useMutation(trpc.groceries.assignToStore.mutationOptions());

  const assignGroceryToStore = (groceryId: string, storeId: string | null, savePreference = true) => {
    // Get the current grocery to check if we're changing stores
    const grocery = groceries.find((g) => g.id === groceryId);
    const isChangingStore = grocery && grocery.storeId !== storeId;

    // Optimistic update
    setGroceriesData((prev) => {
      if (!prev) return prev;

      let updatedGroceries = [...prev.groceries];

      if (isChangingStore) {
        // When moving to a different store, set sortOrder to 0 (top)
        // and increment other items in target store
        updatedGroceries = updatedGroceries.map((g) => {
          if (g.id === groceryId) {
            // The moved item gets sortOrder 0
            return { ...g, storeId, sortOrder: 0 };
          } else if (g.storeId === storeId && !g.isDone) {
            // Other active items in target store get incremented
            return { ...g, sortOrder: (g.sortOrder ?? 0) + 1 };
          }
          return g;
        });
      } else {
        // Just updating storeId without changing (shouldn't happen but handle it)
        updatedGroceries = updatedGroceries.map((g) =>
          g.id === groceryId ? { ...g, storeId } : g
        );
      }

      return {
        ...prev,
        groceries: updatedGroceries,
      };
    });

    assignToStoreMutation.mutate(
      { groceryId, storeId, savePreference },
      {
        onError: (error) => {
          log.error({ error, groceryId, storeId }, "Failed to assign grocery to store");
          invalidate();
        },
      }
    );
  };

  const reorderMutation = useMutation(trpc.groceries.reorderInStore.mutationOptions());

  const reorderGroceriesInStore = (updates: { id: string; sortOrder: number }[], updateBackend = false) => {
    // Optimistic update always happens during drag for smooth UX
    setGroceriesData((prev) => {
      if (!prev) return prev;

      const updateMap = new Map(updates.map((u) => [u.id, u.sortOrder]));

      // Update sortOrder and sort the array by it
      const updatedGroceries = prev.groceries
        .map((g) => {
          const newSortOrder = updateMap.get(g.id);
          return newSortOrder !== undefined ? { ...g, sortOrder: newSortOrder } : g;
        })
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      return {
        ...prev,
        groceries: updatedGroceries,
      };
    });

    // Call backend on drag end (when updateBackend=true)
    if (updateBackend) {
      reorderMutation.mutate({ updates }, {
        onError: (error) => {
          log.error({ error, updateCount: updates.length }, "Failed to reorder groceries");
          invalidate();
        },
      });
    }
  };

  const markAllDoneInStore = (storeId: string | null) => {
    // Optimistic update - mark all active groceries in this store as done
    setGroceriesData((prev) => {
      if (!prev) return prev;

      const updatedGroceries = prev.groceries.map((g) => {
        if (g.storeId === storeId && !g.isDone) {
          return { ...g, isDone: true };
        }
        return g;
      });

      return {
        ...prev,
        groceries: updatedGroceries,
      };
    });

    markAllDoneMutation.mutate({ storeId }, {
      onError: (error) => {
        log.error({ error, storeId }, "Failed to mark groceries as done");
        invalidate();
      },
    });
  };

  const deleteDoneInStore = (storeId: string | null) => {
    // Optimistic update - remove done groceries in this store
    setGroceriesData((prev) => {
      if (!prev) return prev;

      const updatedGroceries = prev.groceries.filter(
        (g) => !(g.storeId === storeId && g.isDone)
      );

      return {
        ...prev,
        groceries: updatedGroceries,
      };
    });

    deleteDoneMutation.mutate({ storeId }, {
      onError: (error) => {
        log.error({ error, storeId }, "Failed to delete done groceries");
        invalidate();
      },
    });
  };

  return {
    // Actions
    createGrocery,
    createGroceriesFromData,
    createRecurringGrocery,
    toggleGroceries,
    toggleRecurringGrocery,
    updateGrocery,
    updateRecurringGrocery,
    deleteGroceries,
    deleteRecurringGrocery,
    getRecurringGroceryForGrocery,
    assignGroceryToStore,
    reorderGroceriesInStore,
    markAllDoneInStore,
    deleteDoneInStore,
  };
}
