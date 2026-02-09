import type { Slot } from "@/types";

export type PlannedItemDisplay = {
  id: string;
  date: string;
  slot: Slot;
  sortOrder: number;
  itemType: "recipe" | "note";
  recipeId: string | null;
  title: string | null;
  recipeName?: string | null;
  recipeImage?: string | null;
  servings?: number | null;
  calories?: number | null;
};

export type TimelineDay = {
  date: Date;
  dateKey: string;
  isToday: boolean;
  items: PlannedItemDisplay[];
};

export const SLOTS: Slot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export const SLOT_ORDER: Record<Slot, number> = {
  Breakfast: 0,
  Lunch: 1,
  Dinner: 2,
  Snack: 3,
};

/**
 * Build subtitle string for a planned item
 */
export function buildItemSubtitle(
  item: PlannedItemDisplay,
  translations: { serving: string; servings: string }
): string {
  const parts: string[] = [];

  if (item.itemType === "recipe") {
    if (item.calories && item.calories > 0) {
      parts.push(`${item.calories} kcal`);
    }
    if (item.servings && item.servings > 0) {
      parts.push(
        `${item.servings} ${item.servings === 1 ? translations.serving : translations.servings}`
      );
    }
  }

  return parts.join(" · ");
}
