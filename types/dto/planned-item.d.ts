import type { Slot } from "./planned-recipe";

export type PlannedItemType = "recipe" | "note";

interface PlannedItemBase {
  id: string;
  date: string;
  slot: Slot;
  sortOrder: number;
  itemType: PlannedItemType;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlannedRecipeItem extends PlannedItemBase {
  itemType: "recipe";
  recipeId: string;
  title: null;
  recipeName: string | null;
  recipeImage: string | null;
  servings: number | null;
  calories: number | null;
  allergyWarnings?: string[];
}

export interface PlannedNoteItem extends PlannedItemBase {
  itemType: "note";
  recipeId: string | null;
  title: string;
}

export type PlannedItemViewDto = PlannedRecipeItem | PlannedNoteItem;

export interface PlannedItemCreateInput {
  date: string;
  slot: Slot;
  itemType: PlannedItemType;
  recipeId?: string;
  title?: string;
}

export interface PlannedItemMoveInput {
  itemId: string;
  targetDate: string;
  targetSlot: Slot;
  targetIndex: number;
}

export interface PlannedItemDeleteInput {
  itemId: string;
}
