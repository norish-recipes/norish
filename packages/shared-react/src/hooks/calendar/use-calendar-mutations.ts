import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

import type {
  CalendarCacheHelpers,
  CalendarMutationsResult,
  CreateCalendarHooksOptions,
} from "./types";

type CreateUseCalendarMutationsOptions = CreateCalendarHooksOptions & {
  useCalendarCacheHelpers: (startISO: string, endISO: string) => CalendarCacheHelpers;
};

export function createUseCalendarMutations({
  useTRPC,
  useCalendarCacheHelpers,
}: CreateUseCalendarMutationsOptions) {
  return function useCalendarMutations(startISO: string, endISO: string): CalendarMutationsResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.calendar.listItems.queryKey({ startISO, endISO });
    const { setCalendarData, invalidate } = useCalendarCacheHelpers(startISO, endISO);

    const getCurrentItemVersion = (itemId: string): number => {
      const items = queryClient.getQueryData<PlannedItemFromQuery[]>(queryKey) ?? [];

      return items.find((item) => item.id === itemId)?.version ?? 1;
    };

    const createMutation = useMutation(
      trpc.calendar.createItem.mutationOptions({
        onError: () => invalidate(),
      })
    );

    const deleteMutation = useMutation(
      trpc.calendar.deleteItem.mutationOptions({
        onMutate: async ({ itemId }) => {
          await queryClient.cancelQueries({ queryKey });
          const previousItems = queryClient.getQueryData<PlannedItemFromQuery[]>(queryKey);

          setCalendarData((prev) => {
            if (!prev) return prev;

            return prev.filter((item) => item.id !== itemId);
          });

          return { previousItems };
        },
        onError: (_err, _vars, context) => {
          if (context?.previousItems) {
            setCalendarData(() => context.previousItems);
          }
        },
      })
    );

    const moveMutation = useMutation(
      trpc.calendar.moveItem.mutationOptions({
        onMutate: async ({ itemId, targetDate, targetSlot, targetIndex }) => {
          await queryClient.cancelQueries({ queryKey });
          const previousItems = queryClient.getQueryData<PlannedItemFromQuery[]>(queryKey);

          setCalendarData((prev) => {
            if (!prev) return prev;

            const itemToMove = prev.find((item) => item.id === itemId);

            if (!itemToMove) return prev;

            const sourceDate = itemToMove.date;
            const sourceSlot = itemToMove.slot;
            const isSameSlot = sourceDate === targetDate && sourceSlot === targetSlot;

            const updated = prev.map((item) => {
              if (item.id === itemId) {
                return {
                  ...item,
                  date: targetDate,
                  slot: targetSlot,
                  sortOrder: targetIndex,
                  updatedAt: new Date(),
                };
              }

              if (item.date === targetDate && item.slot === targetSlot) {
                if (isSameSlot) {
                  if (item.sortOrder >= targetIndex && item.sortOrder < itemToMove.sortOrder) {
                    return { ...item, sortOrder: item.sortOrder + 1 };
                  }
                  if (item.sortOrder <= targetIndex && item.sortOrder > itemToMove.sortOrder) {
                    return { ...item, sortOrder: item.sortOrder - 1 };
                  }
                } else {
                  if (item.sortOrder >= targetIndex) {
                    return { ...item, sortOrder: item.sortOrder + 1 };
                  }
                }
              }

              if (!isSameSlot && item.date === sourceDate && item.slot === sourceSlot) {
                if (item.sortOrder > itemToMove.sortOrder) {
                  return { ...item, sortOrder: item.sortOrder - 1 };
                }
              }

              return item;
            });

            return updated.sort((a, b) => {
              if (a.date !== b.date) return a.date.localeCompare(b.date);
              if (a.slot !== b.slot) return a.slot.localeCompare(b.slot);

              return a.sortOrder - b.sortOrder;
            });
          });

          return { previousItems };
        },
        onError: (_err, _vars, context) => {
          if (context?.previousItems) {
            setCalendarData(() => context.previousItems);
          }
        },
      })
    );

    const updateMutation = useMutation(
      trpc.calendar.updateItem.mutationOptions({
        onMutate: async ({ itemId, title }) => {
          await queryClient.cancelQueries({ queryKey });
          const previousItems = queryClient.getQueryData<PlannedItemFromQuery[]>(queryKey);

          setCalendarData((prev) => {
            if (!prev) return prev;

            return prev.map((item) =>
              item.id === itemId ? { ...item, title, updatedAt: new Date() } : item
            );
          });

          return { previousItems };
        },
        onError: (_err, _vars, context) => {
          if (context?.previousItems) {
            setCalendarData(() => context.previousItems);
          }
        },
      })
    );

    const createItem = (
      date: string,
      slot: Slot,
      itemType: "recipe" | "note",
      recipeId?: string,
      title?: string
    ) => {
      createMutation.mutate({ date, slot, itemType, recipeId, title });
    };

    const deleteItem = (itemId: string) => {
      deleteMutation.mutate({ itemId, version: getCurrentItemVersion(itemId) });
    };

    const moveItem = (
      itemId: string,
      targetDate: string,
      targetSlot: Slot,
      targetIndex: number
    ) => {
      moveMutation.mutate({
        itemId,
        version: getCurrentItemVersion(itemId),
        targetDate,
        targetSlot,
        targetIndex,
      });
    };

    const updateItem = (itemId: string, title: string) => {
      updateMutation.mutate({ itemId, version: getCurrentItemVersion(itemId), title });
    };

    return {
      createItem,
      deleteItem,
      moveItem,
      updateItem,
      isCreating: createMutation.isPending,
      isDeleting: deleteMutation.isPending,
      isMoving: moveMutation.isPending,
      isUpdating: updateMutation.isPending,
    };
  };
}
