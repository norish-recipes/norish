"use client";

import type { Slot, CalendarItemViewDto } from "@/types";

import { useMutation } from "@tanstack/react-query";

import { useCalendarQuery } from "./use-calendar-query";
import { useHouseholdContext } from "@/context/household-context";

import { useTRPC } from "@/app/providers/trpc-provider";

export type CalendarMutationsResult = {
  createPlannedRecipe: (date: string, slot: Slot, recipeId: string, recipeName: string, recipeTags?: string[]) => void;
  deletePlannedRecipe: (id: string, date: string) => void;
  updatePlannedRecipeDate: (id: string, newDate: string, oldDate: string) => void;
  createNote: (date: string, slot: Slot, title: string) => void;
  deleteNote: (id: string, date: string) => void;
  updateNoteDate: (id: string, newDate: string, oldDate: string) => void;
};

export function useCalendarMutations(startISO: string, endISO: string): CalendarMutationsResult {
  const trpc = useTRPC();
  const {
    setCalendarData,
    removeRecipeFromCache,
    updateRecipeInCache,
    removeNoteFromCache,
    updateNoteInCache,
    invalidate,
  } = useCalendarQuery(startISO, endISO);
  const { household } = useHouseholdContext();

  const createRecipeMutation = useMutation(trpc.calendar.createRecipe.mutationOptions());
  const deleteRecipeMutation = useMutation(trpc.calendar.deleteRecipe.mutationOptions());
  const updateRecipeDateMutation = useMutation(trpc.calendar.updateRecipeDate.mutationOptions());
  const createNoteMutation = useMutation(trpc.calendar.createNote.mutationOptions());
  const deleteNoteMutation = useMutation(trpc.calendar.deleteNote.mutationOptions());
  const updateNoteDateMutation = useMutation(trpc.calendar.updateNoteDate.mutationOptions());

  const createPlannedRecipe = (
    date: string,
    slot: Slot,
    recipeId: string,
    recipeName: string,
    recipeTags?: string[]
  ): void => {
    const allergyWarnings = new Set<string>();
    if (recipeTags && household?.allergies) {
      const tagSet = new Set(recipeTags.map(t => t.toLowerCase()));

      household.allergies.forEach(allergy => {
        if (tagSet.has(allergy.toLowerCase())) {
          allergyWarnings.add(allergy);
        }
      });
    }
    createRecipeMutation.mutate(
      { date, slot, recipeId },
      {
        onSuccess: (id) => {
          setCalendarData((prev) => {
            const arr = prev[date] ?? [];

            if (arr.some((i) => i.id === id)) return prev;

            const item: CalendarItemViewDto = {
              itemType: "recipe",
              id,
              recipeId,
              recipeName,
              slot,
              date,
              allergyWarnings: [...allergyWarnings],
            };

            return { ...prev, [date]: [...arr, item] };
          });
        },
        onError: () => invalidate(),
      }
    );
  };

  const deletePlannedRecipe = (id: string, date: string): void => {
    // Optimistic update - remove from base query cache
    removeRecipeFromCache(id);
    setCalendarData((prev) => {
      const arr = prev[date] ?? [];

      return { ...prev, [date]: arr.filter((i) => i.id !== id) };
    });

    deleteRecipeMutation.mutate(
      { id, date },
      {
        onError: () => invalidate(),
      }
    );
  };

  const updatePlannedRecipeDate = (id: string, newDate: string, oldDate: string): void => {
    // Optimistic update - update the base query cache
    updateRecipeInCache(id, newDate);

    // Also update the combined/optimistic data
    setCalendarData((prev) => {
      const oldArr = prev[oldDate] ?? [];
      const item = oldArr.find((i) => i.id === id);

      if (!item) return prev;

      const newArr = prev[newDate] ?? [];
      const updatedItem = { ...item, date: newDate };

      return {
        ...prev,
        [oldDate]: oldArr.filter((i) => i.id !== id),
        [newDate]: [...newArr, updatedItem],
      };
    });

    updateRecipeDateMutation.mutate(
      { id, newDate, oldDate },
      {
        onError: () => invalidate(),
      }
    );
  };

  const createNote = (date: string, slot: Slot, title: string): void => {
    createNoteMutation.mutate(
      { date, slot, title },
      {
        onSuccess: (id) => {
          setCalendarData((prev) => {
            const arr = prev[date] ?? [];

            // Check if already exists (from subscription)
            if (arr.some((i) => i.id === id)) return prev;

            const item: CalendarItemViewDto = {
              itemType: "note",
              id,
              title,
              recipeId: null,
              slot,
              date,
            };

            return { ...prev, [date]: [...arr, item] };
          });
        },
        onError: () => invalidate(),
      }
    );
  };

  const deleteNote = (id: string, date: string): void => {
    // Optimistic update - remove from base query cache
    removeNoteFromCache(id);
    setCalendarData((prev) => {
      const arr = prev[date] ?? [];

      return { ...prev, [date]: arr.filter((i) => i.id !== id) };
    });

    deleteNoteMutation.mutate(
      { id, date },
      {
        onError: () => invalidate(),
      }
    );
  };

  const updateNoteDate = (id: string, newDate: string, oldDate: string): void => {
    // Optimistic update - update the base query cache
    updateNoteInCache(id, newDate);

    // Also update the combined/optimistic data
    setCalendarData((prev) => {
      const oldArr = prev[oldDate] ?? [];
      const item = oldArr.find((i) => i.id === id);

      if (!item) return prev;

      const newArr = prev[newDate] ?? [];
      const updatedItem = { ...item, date: newDate };

      return {
        ...prev,
        [oldDate]: oldArr.filter((i) => i.id !== id),
        [newDate]: [...newArr, updatedItem],
      };
    });

    updateNoteDateMutation.mutate(
      { id, newDate, oldDate },
      {
        onError: () => invalidate(),
      }
    );
  };

  return {
    createPlannedRecipe,
    deletePlannedRecipe,
    updatePlannedRecipeDate,
    createNote,
    deleteNote,
    updateNoteDate,
  };
}
