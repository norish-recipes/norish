"use client";

import type { Slot, CalendarItemViewDto } from "@/types";

import { useSubscription } from "@trpc/tanstack-react-query";
import { addToast } from "@heroui/react";

import { useCalendarQuery } from "./use-calendar-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export function useCalendarSubscription(startISO: string, endISO: string) {
  const trpc = useTRPC();
  const {
    setCalendarData,
    removeRecipeFromCache,
    updateRecipeInCache,
    removeNoteFromCache,
    updateNoteInCache,
    invalidate,
  } = useCalendarQuery(startISO, endISO);

  // onRecipePlanned
  useSubscription(
    trpc.calendar.onRecipePlanned.subscriptionOptions(undefined, {
      onData: (payload) => {
        const { plannedRecipe } = payload;

        setCalendarData((prev) => {
          const arr = prev[plannedRecipe.date] ?? [];
          const exists = arr.some((i) => i.id === plannedRecipe.id);

          if (exists) return prev;

          const item: CalendarItemViewDto = {
            itemType: "recipe",
            id: plannedRecipe.id,
            recipeId: plannedRecipe.recipeId,
            recipeName: plannedRecipe.recipeName ?? "Unknown",
            slot: plannedRecipe.slot as Slot,
            date: plannedRecipe.date,
            allergyWarnings: plannedRecipe.allergyWarnings,
          };

          return { ...prev, [plannedRecipe.date]: [...arr, item] };
        });
      },
    })
  );

  // onRecipeDeleted
  useSubscription(
    trpc.calendar.onRecipeDeleted.subscriptionOptions(undefined, {
      onData: (payload) => {
        const { plannedRecipeId, date } = payload;

        // Remove from base query cache and optimistic data
        removeRecipeFromCache(plannedRecipeId);
        setCalendarData((prev) => {
          const arr = prev[date] ?? [];

          return { ...prev, [date]: arr.filter((i) => i.id !== plannedRecipeId) };
        });
      },
    })
  );

  // onRecipeUpdated
  useSubscription(
    trpc.calendar.onRecipeUpdated.subscriptionOptions(undefined, {
      onData: (payload) => {
        const { plannedRecipe, oldDate } = payload;
        const newDate = plannedRecipe.date;

        // Keep the base list query in sync so we don't show duplicates
        // (base query still has the old date until refetch otherwise).
        updateRecipeInCache(plannedRecipe.id, newDate);

        setCalendarData((prev) => {
          // Remove from old date
          const oldArr = (prev[oldDate] ?? []).filter((i) => i.id !== plannedRecipe.id);

          // Add to new date
          const newArr = prev[newDate] ?? [];
          const existsInNew = newArr.some((i) => i.id === plannedRecipe.id);

          const existing =
            (prev[oldDate] ?? []).find((i) => i.id === plannedRecipe.id) ??
            (prev[newDate] ?? []).find((i) => i.id === plannedRecipe.id);

          const item: CalendarItemViewDto = {
            itemType: "recipe",
            id: plannedRecipe.id,
            recipeId: plannedRecipe.recipeId,
            recipeName:
              plannedRecipe.recipeName ??
              (existing && existing.itemType === "recipe" ? existing.recipeName : "Unknown"),
            slot: plannedRecipe.slot as Slot,
            date: plannedRecipe.date,
            allergyWarnings:
              plannedRecipe.allergyWarnings ??
              (existing && existing.itemType === "recipe" ? existing.allergyWarnings : undefined),
          };

          return {
            ...prev,
            [oldDate]: oldArr,
            [newDate]: existsInNew
              ? newArr.map((i) => (i.id === plannedRecipe.id ? item : i))
              : [...newArr, item],
          };
        });
      },
    })
  );

  // onNotePlanned
  useSubscription(
    trpc.calendar.onNotePlanned.subscriptionOptions(undefined, {
      onData: (payload) => {
        const { note } = payload;

        setCalendarData((prev) => {
          const arr = prev[note.date] ?? [];
          const exists = arr.some((i) => i.id === note.id);

          if (exists) return prev;

          const item: CalendarItemViewDto = {
            itemType: "note",
            id: note.id,
            title: note.title,
            recipeId: note.recipeId ?? null,
            slot: note.slot as Slot,
            date: note.date,
          };

          return { ...prev, [note.date]: [...arr, item] };
        });
      },
    })
  );

  // onNoteDeleted
  useSubscription(
    trpc.calendar.onNoteDeleted.subscriptionOptions(undefined, {
      onData: (payload) => {
        const { noteId, date } = payload;

        // Remove from base query cache and optimistic data
        removeNoteFromCache(noteId);
        setCalendarData((prev) => {
          const arr = prev[date] ?? [];

          return { ...prev, [date]: arr.filter((i) => i.id !== noteId) };
        });
      },
    })
  );

  // onNoteUpdated
  useSubscription(
    trpc.calendar.onNoteUpdated.subscriptionOptions(undefined, {
      onData: (payload) => {
        const { note, oldDate } = payload;
        const newDate = note.date;

        // Keep the base list query in sync so we don't show duplicates.
        updateNoteInCache(note.id, newDate);

        setCalendarData((prev) => {
          // Remove from old date
          const oldArr = (prev[oldDate] ?? []).filter((i) => i.id !== note.id);

          // Add to new date
          const newArr = prev[newDate] ?? [];
          const existsInNew = newArr.some((i) => i.id === note.id);

          const item: CalendarItemViewDto = {
            itemType: "note",
            id: note.id,
            title: note.title,
            recipeId: note.recipeId ?? null,
            slot: note.slot as Slot,
            date: note.date,
          };

          return {
            ...prev,
            [oldDate]: oldArr,
            [newDate]: existsInNew
              ? newArr.map((i) => (i.id === note.id ? item : i))
              : [...newArr, item],
          };
        });
      },
    })
  );

  // onFailed
  useSubscription(
    trpc.calendar.onFailed.subscriptionOptions(undefined, {
      onData: (payload) => {
        addToast({
          severity: "danger",
          title: payload.reason,
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
        invalidate();
      },
    })
  );
}
