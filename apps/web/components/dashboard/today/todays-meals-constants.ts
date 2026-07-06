import type { Slot } from "@norish/shared/contracts";

export const TODAY_MEAL_SLOTS: Slot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export const slotTranslationKeys: Record<Slot, "breakfast" | "lunch" | "dinner" | "snack"> = {
  Breakfast: "breakfast",
  Lunch: "lunch",
  Dinner: "dinner",
  Snack: "snack",
};
