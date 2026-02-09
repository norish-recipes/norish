import type { RecipeCategory } from "@/types";

import Fuse, { type IFuseOptions } from "fuse.js";

const FUZZY_THRESHOLD = 0.4;

type CategoryEntry = {
  category: RecipeCategory;
  synonyms: string[];
};

const CATEGORY_DATA: CategoryEntry[] = [
  { category: "Breakfast", synonyms: ["breakfast", "brunch", "morning meal"] },
  { category: "Lunch", synonyms: ["lunch", "midday meal"] },
  {
    category: "Dinner",
    synonyms: ["dinner", "supper", "main course", "main dish", "entree", "entrée"],
  },
  {
    category: "Snack",
    synonyms: ["snack", "appetizer", "dessert", "starter", "side", "side dish"],
  },
];

const FUSE_OPTIONS: IFuseOptions<CategoryEntry> = {
  keys: ["synonyms"],
  threshold: FUZZY_THRESHOLD,
  includeScore: true,
};

export function matchCategory(input: string): RecipeCategory | null {
  if (!input || typeof input !== "string") return null;

  const normalized = input.toLowerCase().trim();

  if (!normalized) return null;

  const fuse = new Fuse(CATEGORY_DATA, FUSE_OPTIONS);
  const results = fuse.search(normalized);

  if (results.length === 0) return null;

  const bestMatch = results[0];

  if (bestMatch.score !== undefined && bestMatch.score > FUZZY_THRESHOLD) {
    return null;
  }

  return bestMatch.item.category;
}
