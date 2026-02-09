"use client";

import type { PlannedItemFromQuery } from "@/types";

import { useSubscription } from "@trpc/tanstack-react-query";

import { useCalendarCacheHelpers } from "./use-calendar-cache";

import { useTRPC } from "@/app/providers/trpc-provider";

export function useCalendarSubscription(startISO: string, endISO: string) {
  const trpc = useTRPC();
  const { setCalendarData, invalidate } = useCalendarCacheHelpers(startISO, endISO);

  const setItems = (updater: (prev: PlannedItemFromQuery[]) => PlannedItemFromQuery[]) => {
    setCalendarData((prev) => updater(prev ?? []));
  };

  useSubscription(
    trpc.calendar.onItemCreated.subscriptionOptions(undefined, {
      onData: (payload) => {
        setItems((prev) => {
          const exists = prev.some((item) => item.id === payload.item.id);

          if (exists) return prev;

          const newItem: PlannedItemFromQuery = {
            id: payload.item.id,
            userId: payload.item.userId,
            date: payload.item.date,
            slot: payload.item.slot,
            sortOrder: payload.item.sortOrder,
            itemType: payload.item.itemType,
            recipeId: payload.item.recipeId,
            title: payload.item.title,
            recipeName: payload.item.recipeName,
            recipeImage: payload.item.recipeImage,
            servings: payload.item.servings,
            calories: payload.item.calories,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          return [...prev, newItem].sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            if (a.slot !== b.slot) return a.slot.localeCompare(b.slot);

            return a.sortOrder - b.sortOrder;
          });
        });
      },
    })
  );

  useSubscription(
    trpc.calendar.onItemDeleted.subscriptionOptions(undefined, {
      onData: (payload) => {
        setItems((prev) => prev.filter((item) => item.id !== payload.itemId));
      },
    })
  );

  useSubscription(
    trpc.calendar.onItemMoved.subscriptionOptions(undefined, {
      onData: (payload) => {
        setItems((prev) => {
          const targetSortMap = new Map(payload.targetSlotItems.map((i) => [i.id, i.sortOrder]));
          const sourceSortMap = payload.sourceSlotItems
            ? new Map(payload.sourceSlotItems.map((i) => [i.id, i.sortOrder]))
            : null;

          const updated = prev.map((item) => {
            if (item.id === payload.item.id) {
              return {
                ...item,
                date: payload.item.date,
                slot: payload.item.slot,
                sortOrder: payload.item.sortOrder,
                updatedAt: new Date(),
              };
            }

            if (targetSortMap.has(item.id)) {
              return {
                ...item,
                sortOrder: targetSortMap.get(item.id)!,
              };
            }

            if (sourceSortMap?.has(item.id)) {
              return {
                ...item,
                sortOrder: sourceSortMap.get(item.id)!,
              };
            }

            return item;
          });

          return updated.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            if (a.slot !== b.slot) return a.slot.localeCompare(b.slot);

            return a.sortOrder - b.sortOrder;
          });
        });
      },
    })
  );

  useSubscription(
    trpc.calendar.onItemUpdated.subscriptionOptions(undefined, {
      onData: (payload) => {
        setItems((prev) =>
          prev.map((item) => {
            if (item.id === payload.item.id) {
              return {
                ...item,
                userId: payload.item.userId,
                date: payload.item.date,
                slot: payload.item.slot,
                sortOrder: payload.item.sortOrder,
                itemType: payload.item.itemType,
                recipeId: payload.item.recipeId,
                title: payload.item.title,
                recipeName: payload.item.recipeName,
                recipeImage: payload.item.recipeImage,
                servings: payload.item.servings,
                calories: payload.item.calories,
                updatedAt: new Date(),
              };
            }

            return item;
          })
        );
      },
    })
  );

  useSubscription(
    trpc.calendar.onFailed.subscriptionOptions(undefined, {
      onData: () => {
        invalidate();
      },
    })
  );
}
