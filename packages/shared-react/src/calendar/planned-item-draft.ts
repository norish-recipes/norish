import { useState } from "react";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

import type { PlannedItemChanges } from "./types";
import { isRecipeItem } from "./todays-meals";
import { useCalendarMutations } from "./use-calendar-mutations";

/** What the planned-item sheet edits before it saves. */
export type PlannedItemDraft = { title: string; date: string; slot: Slot };

/**
 * What Save writes for a draft: a note's changed text and a move when the day or slot changed.
 * Null when nothing changed, or when a note's text is blank, which a note cannot be.
 */
export function plannedItemChanges(
  item: PlannedItemFromQuery,
  draft: PlannedItemDraft
): PlannedItemChanges | null {
  const editsText = !isRecipeItem(item);
  const title = draft.title.trim();

  if (editsText && !title) return null;

  const changes: PlannedItemChanges = {};

  if (editsText && title !== item.title) changes.title = title;
  if (draft.date !== item.date || draft.slot !== item.slot) {
    changes.move = { date: draft.date, slot: draft.slot };
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

/** A planned item's edit as a draft: day, slot and a note's text change freely and are written
 * together by `save`; leaving without it discards them. */
export function usePlannedItemDraft(item: PlannedItemFromQuery) {
  const { saveItem } = useCalendarMutations();
  const [draft, setDraft] = useState<PlannedItemDraft>({
    title: item.title ?? "",
    date: item.date,
    slot: item.slot,
  });
  const changes = plannedItemChanges(item, draft);

  return {
    draft,
    changes,
    setTitle: (title: string) => setDraft((current) => ({ ...current, title })),
    setDate: (date: string) => setDraft((current) => ({ ...current, date })),
    setSlot: (slot: Slot) => setDraft((current) => ({ ...current, slot })),
    save: () => {
      if (changes) saveItem(item.id, changes);
    },
  };
}
