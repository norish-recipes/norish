import { useDroppable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

import { dayDropId } from "./day-drop-id";

const SLOT_LABEL_KEYS = {
  Breakfast: "breakfast",
  Lunch: "lunch",
  Dinner: "dinner",
  Snack: "snack",
} as const satisfies Record<Slot, string>;
const SLOTS: Slot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

/** A day as a drop target, and its planned items by slot in slot order, each slot sorted. */
export function useDaySlots(dateKey: string, items: PlannedItemFromQuery[]) {
  const tSlots = useTranslations("common.slots");
  const { setNodeRef, isOver } = useDroppable({
    id: dayDropId(dateKey),
    data: { type: "day", dateKey },
  });
  const slots = SLOTS.flatMap((slot) => {
    const slotItems = items
      .filter((item) => item.slot === slot)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return slotItems.length > 0
      ? [{ slot, label: tSlots(SLOT_LABEL_KEYS[slot]), items: slotItems }]
      : [];
  });

  return { setNodeRef, isOver, slots };
}
