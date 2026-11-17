import { useRef, useState } from "react";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import type { PlannedItemEdit } from "@norish/shared/contracts/zod";

import { isRecipeItem } from "./todays-meals";

/** What the planned-item sheet edits before it saves. */
export type PlannedItemDraft = { title: string; date: string; slot: Slot };

/**
 * What Save writes: each touched field that differs from the live item. Null when none does, or
 * when a note's touched text is blank, which a note cannot be.
 */
export function plannedItemChanges(
  item: PlannedItemFromQuery,
  touched: Partial<PlannedItemDraft>
): PlannedItemEdit | null {
  const title = isRecipeItem(item) ? undefined : touched.title?.trim();

  if (title === "") return null;

  const changes: PlannedItemEdit = {};

  if (title !== undefined && title !== item.title) changes.title = title;
  if (touched.date !== undefined && touched.date !== item.date) changes.date = touched.date;
  if (touched.slot !== undefined && touched.slot !== item.slot) changes.slot = touched.slot;

  return Object.keys(changes).length > 0 ? changes : null;
}

/** A planned item's edit as a draft over the live item: an untouched field follows it, and `save`
 * hands `write` only what the member changed, once; leaving without it discards. */
export function usePlannedItemDraft(
  item: PlannedItemFromQuery,
  write: (itemId: string, changes: PlannedItemEdit) => void
) {
  const [touched, setTouched] = useState<Partial<PlannedItemDraft>>({});
  const savedRef = useRef(false);
  const draft: PlannedItemDraft = {
    title: touched.title ?? item.title ?? "",
    date: touched.date ?? item.date,
    slot: touched.slot ?? item.slot,
  };
  const changes = plannedItemChanges(item, touched);
  const touch = (field: Partial<PlannedItemDraft>) =>
    setTouched((current) => ({ ...current, ...field }));

  return {
    draft,
    changes,
    setTitle: (title: string) => touch({ title }),
    setDate: (date: string) => touch({ date }),
    setSlot: (slot: Slot) => touch({ slot }),
    /** True only for the call that wrote. */
    save: () => {
      if (!changes || savedRef.current) return false;
      savedRef.current = true;
      write(item.id, changes);

      return true;
    },
  };
}
