import { useMutation } from "@tanstack/react-query";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { RecurringGroceryDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";
import { createClientLogger } from "@norish/shared/lib/logger";
import { calculateNextOccurrence, getTodayString } from "@norish/shared/lib/recurrence/calculator";

import type {
  CreateGroceriesHooksOptions,
  GroceriesMutationsResult,
  GroceriesQueryResult,
  GroceryCreateData,
} from "./types";

const log = createClientLogger("GroceriesMutations");

type CreateUseGroceriesMutationsOptions = CreateGroceriesHooksOptions & {
  useGroceriesQuery: () => GroceriesQueryResult;
  useUnitsQuery: () => { units: UnitsMap };
};

export function createUseGroceriesMutations({
  useTRPC,
  useGroceriesQuery,
  useUnitsQuery,
}: CreateUseGroceriesMutationsOptions) {
  return function useGroceriesMutations(): GroceriesMutationsResult {
    const trpc = useTRPC();
    const { units } = useUnitsQuery();
    const { setGroceriesData, invalidate, groceries, recurringGroceries } = useGroceriesQuery();

    const getGroceryVersion = (groceryId: string): number =>
      groceries.find((grocery) => grocery.id === groceryId)?.version ?? 1;

    const getRecurringVersion = (recurringGroceryId: string): number =>
      recurringGroceries.find((grocery) => grocery.id === recurringGroceryId)?.version ?? 1;

    const mapGroceriesWithVersions = (ids: string[]) =>
      ids.map((id) => ({ id, version: getGroceryVersion(id) }));

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
      const parsed = parseIngredientWithDefaults(raw, units)[0]!;
      const groceryData = {
        name: parsed.description,
        amount: parsed.quantity,
        unit: parsed.unitOfMeasure,
        isDone: false,
        storeId: storeId ?? null,
      };

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
        recipeIngredientId: g.recipeIngredientId ?? null,
      }));

      return new Promise((resolve, reject) => {
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

    const createRecurringGrocery = (
      raw: string,
      pattern: RecurrencePattern,
      storeId?: string | null
    ): void => {
      const parsed = parseIngredientWithDefaults(raw, units)[0]!;
      const today = getTodayString();
      const nextDate = calculateNextOccurrence(pattern, today);

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
      setGroceriesData((prev) => {
        if (!prev) return prev;
        const updated = prev.groceries.map((g) => (ids.includes(g.id) ? { ...g, isDone } : g));

        return { ...prev, groceries: updated };
      });

      toggleMutation.mutate(
        { groceries: mapGroceriesWithVersions(ids), isDone },
        { onError: () => invalidate() }
      );
    };

    const toggleRecurringGrocery = (
      recurringGroceryId: string,
      groceryId: string,
      isDone: boolean
    ) => {
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
        {
          recurringGroceryId,
          recurringVersion: getRecurringVersion(recurringGroceryId),
          groceryId,
          groceryVersion: getGroceryVersion(groceryId),
          isDone,
        },
        { onError: () => invalidate() }
      );
    };

    const updateGrocery = (id: string, raw: string) => {
      const parsed = parseIngredientWithDefaults(raw, units)[0]!;

      setGroceriesData((prev) => {
        if (!prev) return prev;
        const updated = prev.groceries.map((g) =>
          g.id === id
            ? {
                ...g,
                amount: parsed.quantity,
                unit: parsed.unitOfMeasure,
                name: parsed.description,
              }
            : g
        );

        return { ...prev, groceries: updated };
      });

      updateMutation.mutate(
        { groceryId: id, raw, version: getGroceryVersion(id) },
        { onError: () => invalidate() }
      );
    };

    const updateRecurringGrocery = (
      recurringGroceryId: string,
      groceryId: string,
      raw: string,
      pattern: RecurrencePattern | null
    ) => {
      const parsed = parseIngredientWithDefaults(raw, units)[0]!;

      if (pattern) {
        const today = getTodayString();
        const nextDate = calculateNextOccurrence(pattern, today);

        setGroceriesData((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
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
            recurringVersion: getRecurringVersion(recurringGroceryId),
            groceryId,
            groceryVersion: getGroceryVersion(groceryId),
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

        deleteRecurringMutation.mutate(
          { recurringGroceryId, version: getRecurringVersion(recurringGroceryId) },
          { onError: () => invalidate() }
        );
        updateMutation.mutate(
          { groceryId, raw, version: getGroceryVersion(groceryId) },
          { onError: () => invalidate() }
        );
      }
    };

    const deleteGroceries = (ids: string[]) => {
      const idsSet = new Set(ids);

      setGroceriesData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          groceries: prev.groceries.filter((g) => !idsSet.has(g.id)),
        };
      });

      deleteMutation.mutate(
        { groceries: mapGroceriesWithVersions(ids) },
        { onError: () => invalidate() }
      );
    };

    const deleteRecurringGrocery = (recurringGroceryId: string) => {
      setGroceriesData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          recurringGroceries: prev.recurringGroceries.filter((r) => r.id !== recurringGroceryId),
          groceries: prev.groceries.filter((g) => g.recurringGroceryId !== recurringGroceryId),
        };
      });

      deleteRecurringMutation.mutate(
        { recurringGroceryId, version: getRecurringVersion(recurringGroceryId) },
        { onError: () => invalidate() }
      );
    };

    const getRecurringGroceryForGrocery = (groceryId: string): RecurringGroceryDto | null => {
      const grocery = groceries.find((g) => g.id === groceryId);

      if (!grocery?.recurringGroceryId) return null;

      return recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) || null;
    };

    const assignToStoreMutation = useMutation(trpc.groceries.assignToStore.mutationOptions());

    const assignGroceryToStore = (
      groceryId: string,
      storeId: string | null,
      savePreference = true
    ) => {
      setGroceriesData((prev) => {
        if (!prev) return prev;

        const updatedGroceries = prev.groceries.map((g) =>
          g.id === groceryId ? { ...g, storeId } : g
        );

        return {
          ...prev,
          groceries: updatedGroceries,
        };
      });

      assignToStoreMutation.mutate(
        { groceryId, version: getGroceryVersion(groceryId), storeId, savePreference },
        {
          onError: (error) => {
            log.error({ error, groceryId, storeId }, "Failed to assign grocery to store");
            invalidate();
          },
        }
      );
    };

    const reorderMutation = useMutation(trpc.groceries.reorderInStore.mutationOptions());

    const reorderGroceriesInStore = (
      updates: { id: string; sortOrder: number; storeId?: string | null }[]
    ) => {
      setGroceriesData((prev) => {
        if (!prev) return prev;

        const updateMap = new Map(
          updates.map((u) => [u.id, { sortOrder: u.sortOrder, storeId: u.storeId }])
        );

        const updatedGroceries = prev.groceries
          .map((g) => {
            const update = updateMap.get(g.id);

            if (!update) return g;

            const updated = { ...g, sortOrder: update.sortOrder };

            if (update.storeId !== undefined) {
              updated.storeId = update.storeId;
            }

            return updated;
          })
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        return {
          ...prev,
          groceries: updatedGroceries,
        };
      });

      reorderMutation.mutate(
        {
          updates: updates.map((update) => ({
            ...update,
            version: getGroceryVersion(update.id),
          })),
          savePreference: true,
        },
        {
          onError: (error) => {
            log.error({ error, updateCount: updates.length }, "Failed to reorder groceries");
            invalidate();
          },
        }
      );
    };

    const markAllDoneInStore = (storeId: string | null) => {
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

      markAllDoneMutation.mutate(
        {
          storeId,
          groceries: groceries
            .filter((grocery) => grocery.storeId === storeId && !grocery.isDone)
            .map((grocery) => ({ id: grocery.id, version: grocery.version })),
        },
        {
          onError: (error) => {
            log.error({ error, storeId }, "Failed to mark groceries as done");
            invalidate();
          },
        }
      );
    };

    const deleteDoneInStore = (storeId: string | null) => {
      setGroceriesData((prev) => {
        if (!prev) return prev;

        const updatedGroceries = prev.groceries.filter((g) => !(g.storeId === storeId && g.isDone));

        return {
          ...prev,
          groceries: updatedGroceries,
        };
      });

      deleteDoneMutation.mutate(
        {
          storeId,
          groceries: groceries
            .filter((grocery) => grocery.storeId === storeId && grocery.isDone)
            .map((grocery) => ({ id: grocery.id, version: grocery.version })),
        },
        {
          onError: (error) => {
            log.error({ error, storeId }, "Failed to delete done groceries");
            invalidate();
          },
        }
      );
    };

    return {
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
  };
}
