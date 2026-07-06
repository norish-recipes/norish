import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

import { TODAY_MEAL_SLOTS } from "./todays-meals-constants";

export type PlannedItemSubtitleLabels = {
  note: string;
  serving: string;
  servings: string;
};

export function getPlannedItemTitle(item: PlannedItemFromQuery | undefined, fallback: string) {
  if (!item) return fallback;

  return item.recipeName ?? item.title ?? fallback;
}

export function buildPlannedItemSubtitle(
  item: PlannedItemFromQuery | undefined,
  labels: PlannedItemSubtitleLabels
) {
  if (!item) return null;
  if (item.itemType === "note") return labels.note;

  const details = [
    item.servings
      ? `${item.servings} ${item.servings === 1 ? labels.serving : labels.servings}`
      : null,
    item.calories ? `${item.calories} kcal` : null,
  ].filter(Boolean);

  return details.length > 0 ? details.join(" / ") : null;
}

export function groupTodayItemsBySlot(items: PlannedItemFromQuery[]) {
  const grouped: Record<Slot, PlannedItemFromQuery[]> = {
    Breakfast: [],
    Lunch: [],
    Dinner: [],
    Snack: [],
  };

  for (const item of items) {
    grouped[item.slot].push(item);
  }

  for (const slot of TODAY_MEAL_SLOTS) {
    grouped[slot].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return grouped;
}
