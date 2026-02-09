import type { Slot } from "@/types";

export type PlannedItemFromQuery = {
  id: string;
  userId: string;
  date: string;
  slot: Slot;
  sortOrder: number;
  itemType: "recipe" | "note";
  recipeId: string | null;
  title: string | null;
  recipeName: string | null;
  recipeImage: string | null;
  servings: number | null;
  calories: number | null;
  createdAt: Date;
  updatedAt: Date;
};
