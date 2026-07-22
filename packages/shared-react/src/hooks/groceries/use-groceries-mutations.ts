import { useMutation } from "@tanstack/react-query";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import {
  accumulateGroceryAmounts,
  buildGroceryMergeIndex,
  findGroceryMergeTarget,
  groceryMergeKey,
} from "@norish/shared/lib/grocery-merge";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";
import { createClientLogger } from "@norish/shared/lib/logger";
import { createClientId } from "@norish/shared/lib/operation-helpers";
import { calculateNextOccurrence, getTodayString } from "@norish/shared/lib/recurrence/calculator";

import {
  invalidateUnlessPreserved,
  shouldPreserveOptimisticUpdate as preserveOptimisticUpdate,
} from "../optimistic-updates";

import type {
  CreateGroceriesHooksOptions,
  GroceriesData,
  GroceriesMutationsResult,
  GroceriesQueryResult,
  GroceryCreateData,
} from "./types";

const log = createClientLogger("GroceriesMutations");

type CreateGroceriesResult =
  | string[]
  | {
      ids: string[];
      returnedGroceries?: GroceryDto[];
      createdGroceries?: GroceryDto[];
      updatedGroceries?: GroceryDto[];
    };

type CreateRecurringResult = {
  recurringGrocery: RecurringGroceryDto;
  grocery: GroceryDto;
};

function createOptimisticGrocery({
  id,
  name,
  amount,
  unit,
  isDone,
  storeId,
  recipeIngredientId = null,
}: {
  id: string;
  name: string | null;
  amount: number | null;
  unit: string | null;
  isDone: boolean;
  storeId: string | null;
  recipeIngredientId?: string | null;
}): GroceryDto {
  return {
    id,
    version: 1,
    name,
    amount,
    unit,
    isDone,
    recipeIngredientId,
    recurringGroceryId: null,
    storeId,
    sortOrder: 0,
  };
}

function normalizeCreateResult(result: CreateGroceriesResult) {
  if (Array.isArray(result)) {
    return {
      ids: result,
      returnedGroceries: [] as GroceryDto[],
      createdGroceries: [] as GroceryDto[],
      updatedGroceries: [] as GroceryDto[],
    };
  }

  const createdGroceries = result.createdGroceries ?? [];
  const updatedGroceries = result.updatedGroceries ?? [];

  return {
    ids: result.ids,
    returnedGroceries: result.returnedGroceries ?? [...updatedGroceries, ...createdGroceries],
    createdGroceries,
    updatedGroceries,
  };
}

function getStoreKey(storeId: string | null) {
  return storeId ?? "__no_store__";
}

function getGroceryNameKey(name: string | null | undefined) {
  return name?.trim().toLocaleLowerCase() ?? "";
}

function findCachedStoreIdForName(name: string | null | undefined, groceries: GroceryDto[]) {
  const nameKey = getGroceryNameKey(name);

  if (!nameKey) return null;

  const match = groceries.find(
    (grocery) => !grocery.isDone && grocery.storeId && getGroceryNameKey(grocery.name) === nameKey
  );

  return match?.storeId ?? null;
}

function applyCreatedGroceriesToCache(groceries: GroceryDto[], createdGroceries: GroceryDto[]) {
  if (createdGroceries.length === 0) return groceries;

  const createdIds = new Set(createdGroceries.map((grocery) => grocery.id));
  const createdCountByStore = new Map<string, number>();

  for (const grocery of createdGroceries) {
    if (grocery.isDone) continue;

    const storeKey = getStoreKey(grocery.storeId);

    createdCountByStore.set(storeKey, (createdCountByStore.get(storeKey) ?? 0) + 1);
  }

  const shifted = groceries.map((grocery) => {
    if (grocery.isDone || createdIds.has(grocery.id)) return grocery;

    const createdCount = createdCountByStore.get(getStoreKey(grocery.storeId)) ?? 0;

    return createdCount > 0 ? { ...grocery, sortOrder: grocery.sortOrder + createdCount } : grocery;
  });

  return [...createdGroceries, ...shifted.filter((grocery) => !createdIds.has(grocery.id))];
}

function reconcileCreatedGroceries(
  prev: GroceriesData,
  optimisticIds: string[],
  result: CreateGroceriesResult,
  optimisticGroceries: GroceryDto[],
  mergeBaselines?: Map<string, GroceryDto>
) {
  const { ids, returnedGroceries, createdGroceries, updatedGroceries } =
    normalizeCreateResult(result);
  const returnedById = new Map(returnedGroceries.map((grocery) => [grocery.id, grocery]));
  const createdById = new Map(createdGroceries.map((grocery) => [grocery.id, grocery]));
  const updatedById = new Map(updatedGroceries.map((grocery) => [grocery.id, grocery]));
  let groceries = prev.groceries
    .filter((grocery) => !optimisticIds.includes(grocery.id))
    .map((grocery) => {
      const updated = updatedById.get(grocery.id);

      if (updated) return { ...grocery, ...updated };

      // The server did not confirm an optimistic merge onto this row (it
      // merged elsewhere or created a new row): restore the pre-merge state.
      const baseline = mergeBaselines?.get(grocery.id);

      return baseline ?? grocery;
    });

  const createdToInsert: GroceryDto[] = [];

  ids.forEach((id, index) => {
    const optimistic = optimisticGroceries[index];

    if (!optimistic) return;

    const grocery = returnedById.get(id) ?? { ...optimistic, id };
    const created = createdById.get(id);
    const existingIndex = groceries.findIndex((existing) => existing.id === id);
    const alreadyInserting = createdToInsert.some((entry) => entry.id === id);

    if (created) {
      if (!alreadyInserting) createdToInsert.push(created);
    } else if (existingIndex >= 0) {
      groceries = groceries.map((existing, currentIndex) =>
        currentIndex === existingIndex ? { ...existing, ...grocery } : existing
      );
    } else if (!alreadyInserting) {
      // The canonical row is not in the cache (e.g. the server merged into a
      // row this client had not seen yet): insert the server's row.
      createdToInsert.push(grocery);
    }
  });

  return {
    ...prev,
    groceries: applyCreatedGroceriesToCache(groceries, createdToInsert),
  };
}

type OptimisticCreateItem = {
  id: string;
  name: string | null;
  unit: string | null;
  amount: number | null;
  isDone: boolean;
  recipeIngredientId?: string | null;
};

type OptimisticCreatePlan = {
  /** New optimistic rows for non-merged items, in item order. */
  inserts: GroceryDto[];
  /** Ids of those inserted rows (stripped again on reconcile). */
  insertedIds: string[];
  /** Cached-row id → accumulated amount for optimistically merged items. */
  bumpedAmounts: Map<string, number>;
  /** Pre-merge snapshots of bumped cached rows, for reconcile restore. */
  baselines: Map<string, GroceryDto>;
  /** Per item: the id the UI resolves to (canonical for merges). */
  resolvedIds: string[];
  /** Per item: the row backing reconcile pairing. */
  pairingRows: GroceryDto[];
};

/**
 * Apply the shared grocery merge rule (ADR-0009) against the cached rows: an
 * item matching a known not-done row with a compatible unit accumulates onto
 * that canonical row, later batch items can merge onto earlier inserts, and
 * everything else becomes a new optimistic row with its client-minted id.
 */
function planOptimisticCreates(
  cachedGroceries: GroceryDto[],
  items: OptimisticCreateItem[],
  resolveInsertStoreId: (item: OptimisticCreateItem) => string | null
): OptimisticCreatePlan {
  const mergeIndex = buildGroceryMergeIndex(cachedGroceries);
  const insertsById = new Map<string, GroceryDto>();
  const plan: OptimisticCreatePlan = {
    inserts: [],
    insertedIds: [],
    bumpedAmounts: new Map(),
    baselines: new Map(),
    resolvedIds: [],
    pairingRows: [],
  };

  for (const item of items) {
    const target = findGroceryMergeTarget(mergeIndex, item);

    if (target) {
      const mergedAmount = accumulateGroceryAmounts(target.amount, item.amount);
      const pendingInsert = insertsById.get(target.id);

      if (pendingInsert) {
        pendingInsert.amount = mergedAmount;
      } else {
        if (!plan.baselines.has(target.id)) {
          plan.baselines.set(target.id, target);
        }
        plan.bumpedAmounts.set(target.id, mergedAmount);
      }

      plan.resolvedIds.push(target.id);
      plan.pairingRows.push({ ...target, amount: mergedAmount });
      mergeIndex.set(groceryMergeKey(item)!, { ...target, amount: mergedAmount });
      continue;
    }

    const insert = createOptimisticGrocery({
      id: item.id,
      name: item.name,
      amount: item.amount,
      unit: item.unit,
      isDone: item.isDone,
      storeId: resolveInsertStoreId(item),
      recipeIngredientId: item.recipeIngredientId ?? null,
    });

    plan.inserts.push(insert);
    plan.insertedIds.push(insert.id);
    plan.resolvedIds.push(insert.id);
    plan.pairingRows.push(insert);
    insertsById.set(insert.id, insert);

    const key = groceryMergeKey(item);

    if (key) mergeIndex.set(key, insert);
  }

  return plan;
}

function applyOptimisticCreatePlan(prev: GroceriesData, plan: OptimisticCreatePlan): GroceriesData {
  const bumped = prev.groceries.map((grocery) => {
    const amount = plan.bumpedAmounts.get(grocery.id);

    // Bump the version alongside the amount so a follow-up mutation on the
    // merged row sends the version the server will have after this write.
    return amount === undefined ? grocery : { ...grocery, amount, version: grocery.version + 1 };
  });

  return {
    ...prev,
    groceries: applyCreatedGroceriesToCache(bumped, plan.inserts),
  };
}

function applyRecurringCreatedToCache(prev: GroceriesData, result: CreateRecurringResult) {
  const { grocery, recurringGrocery } = result;
  const existingGrocery = prev.groceries.some((existing) => existing.id === grocery.id);
  const existingRecurring = prev.recurringGroceries.some(
    (existing) => existing.id === recurringGrocery.id
  );

  return {
    ...prev,
    groceries: existingGrocery
      ? prev.groceries.map((existing) => (existing.id === grocery.id ? grocery : existing))
      : applyCreatedGroceriesToCache(prev.groceries, [grocery]),
    recurringGroceries: existingRecurring
      ? prev.recurringGroceries.map((existing) =>
          existing.id === recurringGrocery.id ? recurringGrocery : existing
        )
      : [recurringGrocery, ...prev.recurringGroceries],
  };
}

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

    // Keep an optimistic update when its mutation was Queued for Replay rather
    // than refetching it away (see invalidateUnlessPreserved).
    const invalidateUnlessQueued = invalidateUnlessPreserved(invalidate);

    const createMutation = useMutation(trpc.groceries.create.mutationOptions());
    const toggleMutation = useMutation(trpc.groceries.toggle.mutationOptions());
    const updateMutation = useMutation(trpc.groceries.update.mutationOptions());
    const deleteMutation = useMutation(trpc.groceries.delete.mutationOptions());
    const createRecurringMutation = useMutation(trpc.groceries.createRecurring.mutationOptions());
    const updateRecurringMutation = useMutation(trpc.groceries.updateRecurring.mutationOptions());
    const deleteRecurringMutation = useMutation(trpc.groceries.deleteRecurring.mutationOptions());
    const detachRecurringMutation = useMutation(trpc.groceries.detachRecurring.mutationOptions());
    const checkRecurringMutation = useMutation(trpc.groceries.checkRecurring.mutationOptions());
    const markAllDoneMutation = useMutation(trpc.groceries.markAllDone.mutationOptions());
    const deleteDoneMutation = useMutation(trpc.groceries.deleteDone.mutationOptions());

    const createGrocery = (raw: string, storeId?: string | null) => {
      const parsed = parseIngredientWithDefaults(raw, units)[0]!;
      const clientId = createClientId();
      const requestedStoreId = storeId ?? null;
      const groceryData = {
        // Send the client-minted id so the server inserts the row with it; a queued
        // create-then-tick chain then stays valid (ADR-0003).
        id: clientId,
        name: parsed.description,
        amount: parsed.quantity,
        unit: parsed.unitOfMeasure,
        isDone: false,
        storeId: requestedStoreId,
      };
      // The shared merge rule picks a known canonical row from the cache, so
      // an offline add of an existing grocery targets that row instead of
      // inserting a duplicate (ADR-0009).
      const plan = planOptimisticCreates(
        groceries,
        [
          {
            id: clientId,
            name: groceryData.name,
            amount: groceryData.amount ?? null,
            unit: groceryData.unit ?? null,
            isDone: false,
            recipeIngredientId: null,
          },
        ],
        (item) => requestedStoreId ?? findCachedStoreIdForName(item.name, groceries)
      );

      setGroceriesData((prev) => (prev ? applyOptimisticCreatePlan(prev, plan) : prev));

      createMutation.mutate([groceryData], {
        onSuccess: (result: CreateGroceriesResult) => {
          setGroceriesData((prev) =>
            prev
              ? reconcileCreatedGroceries(
                  prev,
                  plan.insertedIds,
                  result,
                  plan.pairingRows,
                  plan.baselines
                )
              : prev
          );
        },
        onError: invalidateUnlessQueued,
      });
    };

    const createGroceriesFromData = (groceryDataList: GroceryCreateData[]): Promise<string[]> => {
      // Mint one client id per item and reuse it for both the sent payload and the
      // optimistic row, so the server inserts with it and reconciliation is a no-op
      // for non-merged rows (ADR-0003).
      const groceriesToCreate = groceryDataList.map((g) => ({
        id: createClientId(),
        name: g.name,
        amount: g.amount ?? null,
        unit: g.unit ?? null,
        isDone: g.isDone ?? false,
        recipeIngredientId: g.recipeIngredientId ?? null,
      }));
      const plan = planOptimisticCreates(groceries, groceriesToCreate, () => null);

      setGroceriesData((prev) => (prev ? applyOptimisticCreatePlan(prev, plan) : prev));

      return new Promise((resolve, reject) => {
        createMutation.mutate(groceriesToCreate, {
          onSuccess: (result: CreateGroceriesResult) => {
            const { ids } = normalizeCreateResult(result);

            setGroceriesData((prev) =>
              prev
                ? reconcileCreatedGroceries(
                    prev,
                    plan.insertedIds,
                    result,
                    plan.pairingRows,
                    plan.baselines
                  )
                : prev
            );
            resolve(ids);
          },
          onError: (error) => {
            if (preserveOptimisticUpdate(error)) {
              // Queued: the optimistic state holds and each item resolved to
              // the id the UI shows — the canonical row for merged items, the
              // client-minted id otherwise (ADR-0003/0009) — so this is a
              // tentative success rather than a rejection.
              resolve(plan.resolvedIds);

              return;
            }

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
          // Client-minted id for the recurring row, honoured on insert (ADR-0003).
          id: createClientId(),
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
          onSuccess: (result: CreateRecurringResult) => {
            setGroceriesData((prev) => (prev ? applyRecurringCreatedToCache(prev, result) : prev));
          },
          onError: invalidateUnlessQueued,
        }
      );
    };

    const toggleGroceries = (ids: string[], isDone: boolean) => {
      setGroceriesData((prev) => {
        if (!prev) return prev;
        // Optimistically bump the version so a follow-up mutation on the same
        // row sends the version the server will have after this write commits.
        const updated = prev.groceries.map((g) =>
          ids.includes(g.id) ? { ...g, isDone, version: g.version + 1 } : g
        );

        return { ...prev, groceries: updated };
      });

      toggleMutation.mutate(
        { groceries: mapGroceriesWithVersions(ids), isDone },
        { onError: invalidateUnlessQueued }
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
          g.id === groceryId ? { ...g, isDone, version: g.version + 1 } : g
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
                ? { ...r, nextPlannedFor: nextDate, lastCheckedDate: today, version: r.version + 1 }
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
        { onError: invalidateUnlessQueued }
      );
    };

    const updateGrocery = (id: string, raw: string, storeId?: string | null) => {
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
                version: g.version + 1,
                ...(storeId !== undefined ? { storeId } : {}),
              }
            : g
        );

        return { ...prev, groceries: updated };
      });

      const mutationPayload: {
        groceryId: string;
        raw: string;
        version: number;
        storeId?: string | null;
      } = {
        groceryId: id,
        raw,
        version: getGroceryVersion(id),
      };

      // Only include storeId when explicitly provided (null = unsorted)
      if (storeId !== undefined) {
        mutationPayload.storeId = storeId;
      }

      updateMutation.mutate(mutationPayload, { onError: invalidateUnlessQueued });
    };

    const updateRecurringGrocery = (
      recurringGroceryId: string,
      groceryId: string,
      raw: string,
      pattern: RecurrencePattern | null,
      storeId?: string | null
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
                    version: g.version + 1,
                    ...(storeId !== undefined ? { storeId } : {}),
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
                    version: r.version + 1,
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
            ...(storeId !== undefined ? { storeId } : {}),
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
          { onError: invalidateUnlessQueued }
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
                    version: g.version + 1,
                    ...(storeId !== undefined ? { storeId } : {}),
                  }
                : g
            ),
          };
        });

        // Single atomic mutation: deleting the recurring row and applying the
        // grocery edit commit together, instead of racing two version-guarded
        // mutations against the same rows.
        detachRecurringMutation.mutate(
          {
            recurringGroceryId,
            recurringVersion: getRecurringVersion(recurringGroceryId),
            groceryId,
            groceryVersion: getGroceryVersion(groceryId),
            raw,
            ...(storeId !== undefined ? { storeId } : {}),
          },
          { onError: invalidateUnlessQueued }
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
        { onError: invalidateUnlessQueued }
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
        { onError: invalidateUnlessQueued }
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
          g.id === groceryId ? { ...g, storeId, version: g.version + 1 } : g
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
            if (preserveOptimisticUpdate(error)) return;
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

            const updated = { ...g, sortOrder: update.sortOrder, version: g.version + 1 };

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
            if (preserveOptimisticUpdate(error)) return;
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
            return { ...g, isDone: true, version: g.version + 1 };
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
            if (preserveOptimisticUpdate(error)) return;
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
            if (preserveOptimisticUpdate(error)) return;
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
