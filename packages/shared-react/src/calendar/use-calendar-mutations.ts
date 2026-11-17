import type { Query } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { PlannedItemFromQuery, RecipeDashboardDTO, Slot } from "@norish/shared/contracts";
import type { PlannedItemWithRecipePayload } from "@norish/shared/contracts/zod";
import type { CalendarRange } from "@norish/shared/lib/helpers";
import { createClientLogger } from "@norish/shared/lib/logger";
import { createClientId } from "@norish/shared/lib/operation-helpers";

import type { CachedCalendarRange, CalendarMutationsResult } from "./types";
import { shouldPreserveOptimisticUpdate } from "../offline/optimistic-updates";
import { usePlatform } from "../platform/platform";
import { rereadOnceWritesSettle } from "../realtime/use-realtime-subscription";
import { useTRPC } from "../trpc";
import { moveItemInRange, moveTargetIndex, upsertItemInRange } from "./calendar-cache-merge";
import { useCalendarCacheHelpers } from "./use-calendar-cache";

/** What a plan shows of its recipe, as a cached recipe list page holds it. */
type ListedRecipe = Pick<RecipeDashboardDTO, "id" | "name" | "image" | "servings" | "calories">;

const log = createClientLogger("CalendarMutations");

type RangeUpdate = (items: PlannedItemFromQuery[], range: CalendarRange) => PlannedItemFromQuery[];

/** Plans and edits land in every cached `calendar.listItems` range, whichever screen shows it. */
export function useCalendarMutations(): CalendarMutationsResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { session, showError } = usePlatform();
  const {
    cachedRanges,
    writeRange,
    upsertItemAcrossRanges,
    removeItemAcrossRanges,
    rereadAllRanges,
  } = useCalendarCacheHelpers();

  // Synchronous, so a second write in the same tick reads this one; a manual write
  // during a cancelled read becomes the state that read reverts to.
  const writeAcrossRanges = (update: RangeUpdate) => {
    const held = cachedRanges();
    const cancelled: Query[] = [];

    for (const { key, range, items } of held) {
      const query = queryClient.getQueryCache().find({ queryKey: key, exact: true });

      if (query?.state.fetchStatus === "fetching") cancelled.push(query);
      void queryClient.cancelQueries({ queryKey: key, exact: true });
      writeRange(key, update(items, range));
    }
    // Nothing else runs a cancelled read again, and the write left its range fresh.
    if (cancelled.length > 0) {
      rereadOnceWritesSettle(queryClient, (query) => cancelled.includes(query));
    }

    return { held };
  };

  const rollBack = (
    error: unknown,
    _variables: unknown,
    context: { held: CachedCalendarRange[] } | undefined
  ) => {
    // Queued: keep the optimistic write; the Outbox will Replay it.
    if (shouldPreserveOptimisticUpdate(error)) return;

    for (const { key, items } of context?.held ?? []) writeRange(key, items);
    // The snapshots can predate a later write or event; reread so each range converges.
    rereadAllRanges();
    log.error({ error }, "Failed to save calendar change");
    showError("The calendar change was not saved. Please try again.", "calendar-mutations");
  };

  // A move or update answers with its item, new version included: the echo is the fast path (ADR-0011).
  // No item (stale, no-op, failed): the optimistic version was never earned, so reread.
  const placeAnswer = (result: { item?: PlannedItemWithRecipePayload }) => {
    if (result.item) upsertItemAcrossRanges(result.item);
    else rereadAllRanges();
  };

  // The newest copy: a range left behind (narrower, or after a reconnect) can hold an older one.
  const findItem = (itemId: string) =>
    cachedRanges()
      .flatMap(({ items }) => items)
      .filter((item) => item.id === itemId)
      .reduce<PlannedItemFromQuery | undefined>(
        (newest, item) => (newest && newest.version >= item.version ? newest : item),
        undefined
      );

  // One plan write at a time: each is its own request, and two can reach the server in either
  // order, so the second waits for the first's answer.
  const planWrites = { id: "calendar-plan-writes" };

  // A planned recipe's name and photo as the cached recipe lists or its page hold them.
  const cachedRecipe = (recipeId: string) => {
    const listed = queryClient
      .getQueriesData<{ pages?: { recipes: ListedRecipe[] }[] }>({
        queryKey: trpc.recipes.list.pathKey(),
      })
      .flatMap(([, data]) => data?.pages?.flatMap((page) => page.recipes) ?? [])
      .find((recipe) => recipe.id === recipeId);
    const page = queryClient.getQueryData(trpc.recipes.get.queryKey({ id: recipeId }));

    return {
      recipeName: listed?.name ?? page?.name ?? null,
      recipeImage: listed?.image ?? page?.images[0]?.image ?? null,
      servings: listed?.servings ?? page?.servings ?? null,
      calories: listed?.calories ?? page?.calories ?? null,
    };
  };

  const { mutate: mutateCreate } = useMutation(
    trpc.calendar.createItem.mutationOptions({
      // Shown at once, last in its slot, under the id the client minted; the answer and the
      // created echo replace it by that id (ADR-0011).
      onMutate: ({ id, date, slot, itemType, recipeId, title }) => {
        const recipe = recipeId ? cachedRecipe(recipeId) : null;
        const userId = session.user?.id ?? "";

        return writeAcrossRanges((items, range) =>
          id
            ? upsertItemInRange(
                items,
                {
                  id,
                  userId,
                  date,
                  slot,
                  sortOrder: moveTargetIndex(items, { id, userId }, date, slot),
                  itemType,
                  recipeId: recipeId ?? null,
                  title: title ?? null,
                  version: 1,
                  recipeName: recipe?.recipeName ?? null,
                  recipeImage: recipe?.recipeImage ?? null,
                  servings: recipe?.servings ?? null,
                  calories: recipe?.calories ?? null,
                },
                range
              )
            : items
        );
      },
      onSuccess: (result) => {
        if (result.item) upsertItemAcrossRanges(result.item);
      },
      onError: rollBack,
      // A move or edit of the new plan waits for it to be stored.
      scope: planWrites,
    })
  );

  const { mutate: mutateDelete } = useMutation(
    trpc.calendar.deleteItem.mutationOptions({
      onMutate: ({ itemId }) =>
        writeAcrossRanges((items) => items.filter((item) => item.id !== itemId)),
      // Stale: the server kept the plan. Otherwise remove it again, over an earlier
      // move's answer or echo that put it back after the optimistic delete (ADR-0011).
      onSuccess: (result, { itemId }) => {
        if (result.stale) rereadAllRanges();
        else removeItemAcrossRanges(itemId);
      },
      onError: rollBack,
      scope: planWrites,
    })
  );

  const { mutate: mutateMove } = useMutation(
    trpc.calendar.moveItem.mutationOptions({
      onMutate: ({ itemId, targetDate, targetSlot, targetIndex }) => {
        const moved = findItem(itemId);
        // No index: last, as each range knows the slot; the server finds the real end.
        const sortOrder = (items: PlannedItemFromQuery[]) =>
          targetIndex ?? (moved ? moveTargetIndex(items, moved, targetDate, targetSlot) : 0);

        return writeAcrossRanges((items, range) =>
          moved
            ? moveItemInRange(
                items,
                moved,
                { date: targetDate, slot: targetSlot, sortOrder: sortOrder(items) },
                range
              )
            : items
        );
      },
      onSuccess: placeAnswer,
      onError: rollBack,
      scope: planWrites,
    })
  );

  const { mutate: mutateUpdate } = useMutation(
    trpc.calendar.updateItem.mutationOptions({
      onMutate: ({ itemId, title }) =>
        writeAcrossRanges((items) =>
          items.map((item) =>
            item.id === itemId
              ? { ...item, title, version: item.version + 1, updatedAt: new Date() }
              : item
          )
        ),
      onSuccess: placeAnswer,
      onError: rollBack,
      scope: planWrites,
    })
  );

  // One write for a whole edit: a new day or slot lands last there, carrying the new text.
  const { mutate: mutateEdit } = useMutation(
    trpc.calendar.editItem.mutationOptions({
      onMutate: ({ itemId, title, date, slot }) => {
        const found = findItem(itemId);

        return writeAcrossRanges((items, range) => {
          if (!found) return items;
          const target = { date: date ?? found.date, slot: slot ?? found.slot };

          if (target.date === found.date && target.slot === found.slot) {
            return items.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    title: title ?? item.title,
                    version: item.version + 1,
                    updatedAt: new Date(),
                  }
                : item
            );
          }
          const edited = { ...found, title: title ?? found.title };
          const sortOrder = moveTargetIndex(items, edited, target.date, target.slot);

          return moveItemInRange(items, edited, { ...target, sortOrder }, range);
        });
      },
      onSuccess: placeAnswer,
      onError: rollBack,
      scope: planWrites,
    })
  );

  const versionOf = (itemId: string) => findItem(itemId)?.version ?? 1;

  return {
    planRecipe: (date, slot, recipeId) => {
      // Client-minted id, honoured on insert (ADR-0003).
      mutateCreate({ id: createClientId(), date, slot, itemType: "recipe", recipeId });
    },
    planNote: (date, slot, title) => {
      mutateCreate({ id: createClientId(), date, slot, itemType: "note", title });
    },
    deleteItem: (itemId) => {
      mutateDelete({ itemId, version: versionOf(itemId) });
    },
    moveItem: (itemId: string, targetDate: string, targetSlot: Slot, targetIndex?: number) => {
      mutateMove({ itemId, version: versionOf(itemId), targetDate, targetSlot, targetIndex });
    },
    updateItem: (itemId, title) => {
      mutateUpdate({ itemId, version: versionOf(itemId), title });
    },
    saveItem: (itemId, changes) => {
      mutateEdit({ itemId, version: versionOf(itemId), ...changes });
    },
  };
}
