import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { recurrencePatternOf } from "@norish/shared/contracts/recurrence";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";
import { createClientLogger } from "@norish/shared/lib/logger";
import { createClientId } from "@norish/shared/lib/operation-helpers";
import { calculateNextOccurrence, getTodayString } from "@norish/shared/lib/recurrence/calculator";

import type { GroceriesData, GroceriesMutationsResult, GroceryCreateData } from "./types";
import { useUnitsQuery } from "../config";
import { shouldPreserveOptimisticUpdate as preserveOptimisticUpdate } from "../offline/optimistic-updates";
import { usePlatform } from "../platform";
import { useTRPC } from "../trpc";

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
  /** The siblings the new line shifted down, at their new versions. */
  shifted?: GroceryDto[];
};

function createOptimisticGrocery({
  id,
  name,
  amount,
  unit,
  isDone,
  storeId,
  recipeIngredientId = null,
  purchaseAmount,
}: {
  id: string;
  name: string | null;
  amount: number | null;
  unit: string | null;
  isDone: boolean;
  storeId: string | null;
  recipeIngredientId?: string | null;
  purchaseAmount?: number | null;
}): GroceryDto {
  return {
    id,
    version: 1,
    name,
    amount,
    purchaseAmount,
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

/** New rows go on top, and the open rows of each Store they join move down to make room. */
export function applyCreatedGroceriesToCache(
  groceries: GroceryDto[],
  createdGroceries: GroceryDto[]
) {
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
  optimisticGroceries: GroceryDto[]
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

      return updated ? { ...grocery, ...updated } : grocery;
    });

  const createdToInsert: GroceryDto[] = [];

  // A name joining foods comes back as a grocery per food, so ids pair with what was sent only 1:1.
  const paired = ids.length === optimisticGroceries.length;

  ids.forEach((id, index) => {
    const optimistic = paired ? optimisticGroceries[index] : undefined;
    const grocery = returnedById.get(id) ?? (optimistic && { ...optimistic, id });

    if (!grocery) return;

    const created = createdById.get(id);
    const existingIndex = groceries.findIndex((existing) => existing.id === id);

    if (created) {
      createdToInsert.push(created);
    } else if (existingIndex >= 0) {
      groceries = groceries.map((existing, currentIndex) =>
        currentIndex === existingIndex ? { ...existing, ...grocery } : existing
      );
    } else if (!updatedById.has(id)) {
      createdToInsert.push(grocery);
    }
  });

  return {
    ...prev,
    groceries: applyCreatedGroceriesToCache(groceries, createdToInsert),
  };
}

function applyRecurringCreatedToCache(prev: GroceriesData, result: CreateRecurringResult) {
  const { grocery, recurringGrocery } = result;
  const existingGrocery = prev.groceries.some((existing) => existing.id === grocery.id);
  const existingRecurring = prev.recurringGroceries.some(
    (existing) => existing.id === recurringGrocery.id
  );
  // The siblings the new line shifted down carry new versions: what the
  // server says they are now replaces the shift guessed here (ADR-0004).
  const shiftedById = new Map((result.shifted ?? []).map((row) => [row.id, row]));
  const withShifted = (rows: GroceryDto[]) =>
    rows.map((row) => {
      const shifted = shiftedById.get(row.id);

      return shifted ? { ...row, ...shifted } : row;
    });

  return {
    ...prev,
    groceries: withShifted(
      existingGrocery
        ? prev.groceries.map((existing) => (existing.id === grocery.id ? grocery : existing))
        : applyCreatedGroceriesToCache(prev.groceries, [grocery])
    ),
    recurringGroceries: existingRecurring
      ? prev.recurringGroceries.map((existing) =>
          existing.id === recurringGrocery.id ? recurringGrocery : existing
        )
      : [recurringGrocery, ...prev.recurringGroceries],
  };
}

/** A grocery as an edit leaves it: name, amount and unit, and the store and pack size if sent. */
function withEdit(
  grocery: GroceryDto,
  edit: Partial<Pick<GroceryDto, "name" | "amount" | "unit">>,
  storeId: string | null | undefined,
  purchaseAmount: number | null | undefined
): GroceryDto {
  return {
    ...grocery,
    ...edit,
    ...(purchaseAmount !== undefined ? { purchaseAmount } : {}),
    ...(storeId !== undefined ? { storeId } : {}),
    version: grocery.version + 1,
  };
}

/** A write's undo: the lists before it, and the rows a create wrote for its answer to replace. */
type Undo = {
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  created: GroceryDto[];
  /** An earlier write's undo already put back lists from before this one. */
  undone: boolean;
};

/** The undos of the list writes still on their way, oldest first. */
const unsettled = new Set<Undo>();

export function useGroceriesMutations(): GroceriesMutationsResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { units } = useUnitsQuery();
  const { showError } = usePlatform();
  const listKey = trpc.groceries.list.queryKey();
  const parse = (raw: string) => {
    const parsed = parseIngredientWithDefaults(raw, units)[0]!;

    return { name: parsed.description, amount: parsed.quantity, unit: parsed.unitOfMeasure };
  };

  const setGroceriesData = (
    updater: (prev: GroceriesData | undefined) => GroceriesData | undefined
  ) => {
    // A read already under way answers for the list as it was: it must not
    // land over this write. The list stays stale, so the next mount or focus
    // reads it again. Stopping a read puts back what was held when it began,
    // which misses a list restored since (an offline load), so the write
    // applies to the list as held now. With nothing held there is nothing
    // to write over, and stopping the first read would leave it loading.
    const held = queryClient.getQueryData<GroceriesData>(listKey);

    if (held) void queryClient.cancelQueries({ queryKey: listKey });
    queryClient.setQueryData<GroceriesData>(listKey, updater(held));
  };

  // An action reads the list from the cache when it runs, never by subscribing, so a component
  // that only acts doesn't re-render when the list changes.
  const held = () => queryClient.getQueryData<GroceriesData>(listKey);
  const versionOf = (rows: Array<{ id: string; version: number }>, id: string) =>
    rows.find((row) => row.id === id)?.version ?? 1;
  const groceryVersion = (id: string) => versionOf(held()?.groceries ?? [], id);
  const recurringVersion = (id: string) => versionOf(held()?.recurringGroceries ?? [], id);
  const withVersions = (ids: string[]) => ids.map((id) => ({ id, version: groceryVersion(id) }));

  /** Holds the lists as they are now, for this write's undo. */
  const hold = (created: GroceryDto[] = []): Undo => {
    const was = {
      groceries: held()?.groceries ?? [],
      recurringGroceries: held()?.recurringGroceries ?? [],
      created,
      undone: false,
    };

    unsettled.add(was);

    return was;
  };
  /** Holds the lists, then writes this change over them. */
  const writeOver = (change: (prev: GroceriesData) => GroceriesData, created?: GroceryDto[]) => {
    const was = hold(created);

    setGroceriesData((prev) => prev && change(prev));

    return was;
  };
  const undo = (was: Undo) => {
    if (was.undone) return;
    setGroceriesData(
      (prev) =>
        prev && { ...prev, groceries: was.groceries, recurringGroceries: was.recurringGroceries }
    );
    // The writes begun after this one were in what it took back, so their undo would restore it.
    let later = false;

    for (const other of unsettled) {
      if (later) other.undone = true;
      later ||= other === was;
    }
  };
  const rejected = (
    error: unknown,
    was: Undo | undefined,
    reason = "The grocery change was not saved. Please try again."
  ) => {
    if (preserveOptimisticUpdate(error)) return;

    if (was) undo(was);
    log.error({ error }, "Failed to save grocery change");
    showError(reason, "groceries-mutations");
  };
  // Each write's undo sits in useMutation's own options, which run whatever is mounted: a `mutate`
  // call's own callbacks are dropped once its observer mutates again.
  const settles = {
    onError: (error: unknown, _input: unknown, was: Undo | undefined) => rejected(error, was),
    onSettled: (_r: unknown, _e: unknown, _i: unknown, was: Undo | undefined) => {
      if (was) unsettled.delete(was);
    },
  };
  const reconcileCreated = (result: CreateGroceriesResult, was: Undo) =>
    setGroceriesData(
      (prev) =>
        prev &&
        reconcileCreatedGroceries(
          prev,
          was.created.map((grocery) => grocery.id),
          result,
          was.created
        )
    );

  const { mutate: mutateCreate } = useMutation(
    trpc.groceries.create.mutationOptions({
      ...settles,
      onMutate: (rows) => {
        const groceries = held()?.groceries ?? [];
        // The id the row was sent with; a server-side duplicate merge may still answer another.
        const optimistic = rows.map((row) =>
          createOptimisticGrocery({
            id: row.id ?? createClientId(),
            name: row.name,
            amount: typeof row.amount === "number" ? row.amount : null,
            purchaseAmount: row.purchaseAmount,
            unit: row.unit,
            isDone: row.isDone ?? false,
            storeId: row.storeId ?? findCachedStoreIdForName(row.name, groceries),
          })
        );

        return writeOver(
          (prev) => ({
            ...prev,
            groceries: applyCreatedGroceriesToCache(prev.groceries, optimistic),
          }),
          optimistic
        );
      },
      onSuccess: (result: CreateGroceriesResult, _rows, was) => reconcileCreated(result, was),
    })
  );
  // The same create, from rows already worked out: they go on top as they are.
  const { mutateAsync: mutateCreateMany } = useMutation(
    trpc.groceries.create.mutationOptions({
      onSettled: settles.onSettled,
      onMutate: (rows) => {
        const optimistic = rows.map((row) =>
          createOptimisticGrocery({
            id: row.id ?? createClientId(),
            name: row.name,
            amount: typeof row.amount === "number" ? row.amount : null,
            unit: row.unit,
            isDone: row.isDone ?? false,
            storeId: null,
            recipeIngredientId: row.recipeIngredientId ?? null,
          })
        );

        return writeOver(
          (prev) => ({ ...prev, groceries: [...optimistic, ...prev.groceries] }),
          optimistic
        );
      },
      onSuccess: (result: CreateGroceriesResult, _rows, was) => reconcileCreated(result, was),
      onError: (error, _rows, was) =>
        rejected(error, was, "The groceries were not saved. Please try again."),
    })
  );
  const { mutate: mutateCreateRecurring } = useMutation(
    trpc.groceries.createRecurring.mutationOptions({
      ...settles,
      // Nothing is written before the answer, which says where the new line goes.
      onMutate: () => hold(),
      onSuccess: (result: CreateRecurringResult) =>
        setGroceriesData((prev) => prev && applyRecurringCreatedToCache(prev, result)),
    })
  );
  const { mutate: mutateToggle } = useMutation(
    trpc.groceries.toggle.mutationOptions({
      ...settles,
      // The version is bumped, so a follow-up write to the row sends the one this write leaves.
      onMutate: ({ groceries: rows, isDone }) => {
        const ids = new Set(rows.map((row) => row.id));

        return writeOver((prev) => ({
          ...prev,
          groceries: prev.groceries.map((g) =>
            ids.has(g.id) ? { ...g, isDone, version: g.version + 1 } : g
          ),
        }));
      },
    })
  );
  const { mutate: mutateCheckRecurring } = useMutation(
    trpc.groceries.checkRecurring.mutationOptions({
      ...settles,
      onMutate: ({ recurringGroceryId, groceryId, isDone }) =>
        writeOver((prev) => {
          const groceries = prev.groceries.map((g) =>
            g.id === groceryId ? { ...g, isDone, version: g.version + 1 } : g
          );
          const recurring = prev.recurringGroceries.find((r) => r.id === recurringGroceryId);

          if (!isDone || !recurring) return { ...prev, groceries };

          const nextPlannedFor = calculateNextOccurrence(
            recurrencePatternOf(recurring),
            recurring.nextPlannedFor,
            recurring.nextPlannedFor
          );

          return {
            ...prev,
            groceries,
            recurringGroceries: prev.recurringGroceries.map((r) =>
              r.id === recurringGroceryId
                ? {
                    ...r,
                    nextPlannedFor,
                    lastCheckedDate: getTodayString(),
                    version: r.version + 1,
                  }
                : r
            ),
          };
        }),
    })
  );
  const { mutate: mutateUpdate } = useMutation(
    trpc.groceries.update.mutationOptions({
      ...settles,
      onMutate: ({ groceryId, raw, storeId, purchaseAmount }) => {
        const edit = parse(raw);

        return writeOver((prev) => ({
          ...prev,
          groceries: prev.groceries.map((g) =>
            g.id === groceryId ? withEdit(g, edit, storeId, purchaseAmount) : g
          ),
        }));
      },
    })
  );
  const { mutate: mutateUpdateRecurring } = useMutation(
    trpc.groceries.updateRecurring.mutationOptions({
      ...settles,
      onMutate: ({ recurringGroceryId, groceryId, storeId, purchaseAmount, data }) =>
        writeOver((prev) => ({
          ...prev,
          groceries: prev.groceries.map((g) =>
            g.id === groceryId ? withEdit(g, data, storeId, purchaseAmount) : g
          ),
          recurringGroceries: prev.recurringGroceries.map((r) =>
            r.id === recurringGroceryId ? { ...r, ...data, version: r.version + 1 } : r
          ),
        })),
    })
  );
  // One atomic write: deleting the recurring row and the grocery's edit commit together, instead
  // of racing two version-guarded writes against the same rows.
  const { mutate: mutateDetachRecurring } = useMutation(
    trpc.groceries.detachRecurring.mutationOptions({
      ...settles,
      onMutate: ({ recurringGroceryId, groceryId, raw, storeId, purchaseAmount }) => {
        const edit = parse(raw);

        return writeOver((prev) => ({
          ...prev,
          recurringGroceries: prev.recurringGroceries.filter((r) => r.id !== recurringGroceryId),
          groceries: prev.groceries.map((g) =>
            g.id === groceryId
              ? { ...withEdit(g, edit, storeId, purchaseAmount), recurringGroceryId: null }
              : g
          ),
        }));
      },
    })
  );
  const { mutate: mutateDelete } = useMutation(
    trpc.groceries.delete.mutationOptions({
      ...settles,
      onMutate: ({ groceries: rows }) => {
        const ids = new Set(rows.map((row) => row.id));

        return writeOver((prev) => ({
          ...prev,
          groceries: prev.groceries.filter((g) => !ids.has(g.id)),
        }));
      },
    })
  );
  const { mutate: mutateDeleteRecurring } = useMutation(
    trpc.groceries.deleteRecurring.mutationOptions({
      ...settles,
      onMutate: ({ recurringGroceryId }) =>
        writeOver((prev) => ({
          ...prev,
          recurringGroceries: prev.recurringGroceries.filter((r) => r.id !== recurringGroceryId),
          groceries: prev.groceries.filter((g) => g.recurringGroceryId !== recurringGroceryId),
        })),
    })
  );
  const { mutate: mutateAssignToStore } = useMutation(
    trpc.groceries.assignToStore.mutationOptions({
      ...settles,
      onMutate: ({ groceryId, storeId }) =>
        writeOver((prev) => ({
          ...prev,
          groceries: prev.groceries.map((g) =>
            g.id === groceryId ? { ...g, storeId, version: g.version + 1 } : g
          ),
        })),
    })
  );
  const { mutate: mutateReorder } = useMutation(
    trpc.groceries.reorderInStore.mutationOptions({
      ...settles,
      onMutate: ({ updates }) => {
        const byId = new Map(updates.map((update) => [update.id, update]));

        return writeOver((prev) => ({
          ...prev,
          groceries: prev.groceries
            .map((g) => {
              const update = byId.get(g.id);

              if (!update) return g;

              return {
                ...g,
                sortOrder: update.sortOrder,
                version: g.version + 1,
                ...(update.storeId !== undefined ? { storeId: update.storeId } : {}),
              };
            })
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        }));
      },
    })
  );
  const { mutate: mutateMarkAllDone } = useMutation(
    trpc.groceries.markAllDone.mutationOptions({
      ...settles,
      onMutate: ({ storeId }) =>
        writeOver((prev) => ({
          ...prev,
          groceries: prev.groceries.map((g) =>
            g.storeId === storeId && !g.isDone ? { ...g, isDone: true, version: g.version + 1 } : g
          ),
        })),
    })
  );
  const { mutate: mutateDeleteDone } = useMutation(
    trpc.groceries.deleteDone.mutationOptions({
      ...settles,
      onMutate: ({ storeId }) =>
        writeOver((prev) => ({
          ...prev,
          groceries: prev.groceries.filter((g) => !(g.storeId === storeId && g.isDone)),
        })),
    })
  );

  const createGrocery = (raw: string, storeId?: string | null, purchaseAmount?: number | null) => {
    const { name, amount, unit } = parse(raw);

    // One client-minted id for the sent row and the optimistic one.
    mutateCreate([
      {
        id: createClientId(),
        name,
        amount,
        ...(purchaseAmount !== undefined ? { purchaseAmount } : {}),
        unit,
        isDone: false,
        storeId: storeId ?? null,
      },
    ]);
  };

  const createGroceriesFromData = (groceryDataList: GroceryCreateData[]): Promise<string[]> => {
    const rows = groceryDataList.map((g) => ({
      id: createClientId(),
      name: g.name,
      amount: g.amount ?? null,
      unit: g.unit ?? null,
      isDone: g.isDone ?? false,
      recipeIngredientId: g.recipeIngredientId ?? null,
    }));

    return mutateCreateMany(rows).then(
      (result: CreateGroceriesResult) => normalizeCreateResult(result).ids,
      (error: unknown) => {
        // Queued: the optimistic rows hold and their ids are the ones Replay inserts (ADR-0003),
        // so this is a tentative success.
        if (preserveOptimisticUpdate(error)) return rows.map((row) => row.id);
        throw error;
      }
    );
  };

  const createRecurringGrocery = (
    raw: string,
    pattern: RecurrencePattern,
    storeId?: string | null,
    purchaseAmount?: number | null
  ): void => {
    const { name, amount, unit } = parse(raw);

    mutateCreateRecurring({
      // Client-minted id for the recurring row, honoured on insert (ADR-0003).
      id: createClientId(),
      name,
      amount: amount ?? null,
      ...(purchaseAmount !== undefined ? { purchaseAmount } : {}),
      unit,
      recurrenceRule: pattern.rule,
      recurrenceInterval: pattern.interval || 1,
      recurrenceWeekday: pattern.weekday ?? null,
      nextPlannedFor: calculateNextOccurrence(pattern, getTodayString()),
      storeId: storeId ?? null,
    });
  };

  const toggleGroceries = (ids: string[], isDone: boolean) =>
    mutateToggle({ groceries: withVersions(ids), isDone });

  const toggleRecurringGrocery = (recurringGroceryId: string, groceryId: string, isDone: boolean) =>
    mutateCheckRecurring({
      recurringGroceryId,
      recurringVersion: recurringVersion(recurringGroceryId),
      groceryId,
      groceryVersion: groceryVersion(groceryId),
      isDone,
    });

  const updateGrocery = (
    id: string,
    raw: string,
    storeId?: string | null,
    purchaseAmount?: number | null
  ) =>
    mutateUpdate({
      groceryId: id,
      raw,
      purchaseAmount,
      version: groceryVersion(id),
      // Only when chosen: null is unsorted.
      ...(storeId !== undefined ? { storeId } : {}),
    });

  const updateRecurringGrocery = (
    recurringGroceryId: string,
    groceryId: string,
    raw: string,
    pattern: RecurrencePattern | null,
    storeId?: string | null,
    purchaseAmount?: number | null
  ) => {
    const versions = {
      recurringGroceryId,
      recurringVersion: recurringVersion(recurringGroceryId),
      groceryId,
      groceryVersion: groceryVersion(groceryId),
      purchaseAmount,
      ...(storeId !== undefined ? { storeId } : {}),
    };

    if (!pattern) {
      mutateDetachRecurring({ ...versions, raw });

      return;
    }
    const { name, amount, unit } = parse(raw);

    mutateUpdateRecurring({
      ...versions,
      data: {
        name,
        amount: amount ?? null,
        unit,
        recurrenceRule: pattern.rule,
        recurrenceInterval: pattern.interval,
        recurrenceWeekday: pattern.weekday ?? null,
        nextPlannedFor: calculateNextOccurrence(pattern, getTodayString()),
      },
    });
  };

  const deleteGroceries = (ids: string[]) => mutateDelete({ groceries: withVersions(ids) });

  const deleteRecurringGrocery = (recurringGroceryId: string) =>
    mutateDeleteRecurring({ recurringGroceryId, version: recurringVersion(recurringGroceryId) });

  const assignGroceryToStore = (groceryId: string, storeId: string | null, savePreference = true) =>
    mutateAssignToStore({ groceryId, version: groceryVersion(groceryId), storeId, savePreference });

  const reorderGroceriesInStore = (
    updates: { id: string; sortOrder: number; storeId?: string | null }[]
  ) =>
    mutateReorder({
      updates: updates.map((update) => ({ ...update, version: groceryVersion(update.id) })),
      savePreference: true,
    });

  // The rows the store holds as this reader sees them, each at its version.
  const inStore = (storeId: string | null, isDone: boolean) =>
    (held()?.groceries ?? [])
      .filter((grocery) => grocery.storeId === storeId && grocery.isDone === isDone)
      .map((grocery) => ({ id: grocery.id, version: grocery.version }));

  const markAllDoneInStore = (storeId: string | null) =>
    mutateMarkAllDone({ storeId, groceries: inStore(storeId, false) });

  const deleteDoneInStore = (storeId: string | null) =>
    mutateDeleteDone({ storeId, groceries: inStore(storeId, true) });

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
    assignGroceryToStore,
    reorderGroceriesInStore,
    markAllDoneInStore,
    deleteDoneInStore,
  };
}
