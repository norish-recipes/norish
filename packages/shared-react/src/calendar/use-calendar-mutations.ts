import type { Query } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import type { CalendarRange } from "@norish/shared/lib/helpers";
import { createClientId } from "@norish/shared/lib/operation-helpers";

import type { CachedCalendarRange, CalendarMutationsResult } from "./types";
import {
  invalidateUnlessPreserved,
  shouldPreserveOptimisticUpdate,
} from "../offline/optimistic-updates";
import { rereadOnceWritesSettle } from "../realtime/use-realtime-subscription";
import { useTRPC } from "../trpc";
import { moveItemInRange } from "./calendar-cache-merge";
import { useCalendarCacheHelpers } from "./use-calendar-cache";

type RangeUpdate = (items: PlannedItemFromQuery[], range: CalendarRange) => PlannedItemFromQuery[];

/** Plans and edits land in every cached `calendar.listItems` range, whichever screen shows it. */
export function useCalendarMutations(): CalendarMutationsResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { cachedRanges, writeRange, upsertItemAcrossRanges, rereadAllRanges } =
    useCalendarCacheHelpers();

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
  };

  // The server drops version-stale writes; reread so the optimistic write converges.
  const rereadIfStale = (result: object) => {
    if ("stale" in result && result.stale) rereadAllRanges();
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

  const createMutation = useMutation(
    trpc.calendar.createItem.mutationOptions({
      // The created item is placed in every cached range from the response
      // itself: the realtime echo is the fast path, not the guarantee (ADR-0011).
      onSuccess: (result) => {
        if (result.item) upsertItemAcrossRanges(result.item);
      },
      // Queued for Replay when the backend is unreachable — nothing to refetch.
      onError: invalidateUnlessPreserved(rereadAllRanges),
    })
  );
  const { mutate: mutateCreate } = createMutation;

  const deleteMutation = useMutation(
    trpc.calendar.deleteItem.mutationOptions({
      onMutate: ({ itemId }) =>
        writeAcrossRanges((items) => items.filter((item) => item.id !== itemId)),
      onSuccess: rereadIfStale,
      onError: rollBack,
    })
  );
  const { mutate: mutateDelete } = deleteMutation;

  const moveMutation = useMutation(
    trpc.calendar.moveItem.mutationOptions({
      onMutate: ({ itemId, targetDate, targetSlot, targetIndex }) => {
        const moved = findItem(itemId);
        const target = { date: targetDate, slot: targetSlot, sortOrder: targetIndex };

        return writeAcrossRanges((items, range) =>
          moved ? moveItemInRange(items, moved, target, range) : items
        );
      },
      onSuccess: rereadIfStale,
      onError: rollBack,
    })
  );
  const { mutate: mutateMove } = moveMutation;

  const updateMutation = useMutation(
    trpc.calendar.updateItem.mutationOptions({
      onMutate: ({ itemId, title }) =>
        writeAcrossRanges((items) =>
          items.map((item) =>
            item.id === itemId ? { ...item, title, updatedAt: new Date() } : item
          )
        ),
      onSuccess: rereadIfStale,
      onError: rollBack,
    })
  );
  const { mutate: mutateUpdate } = updateMutation;

  const versionOf = (itemId: string) => findItem(itemId)?.version ?? 1;

  return {
    createItem: (date, slot, itemType, recipeId, title) => {
      // Client-minted id, honoured on insert (ADR-0003).
      mutateCreate({ id: createClientId(), date, slot, itemType, recipeId, title });
    },
    deleteItem: (itemId) => {
      mutateDelete({ itemId, version: versionOf(itemId) });
    },
    moveItem: (itemId: string, targetDate: string, targetSlot: Slot, targetIndex: number) => {
      mutateMove({ itemId, version: versionOf(itemId), targetDate, targetSlot, targetIndex });
    },
    updateItem: (itemId, title) => {
      mutateUpdate({ itemId, version: versionOf(itemId), title });
    },
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isMoving: moveMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
