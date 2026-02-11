import type { RecipeCategory } from "@/types";

import Fuse, { type IFuseOptions } from "fuse.js";

import enRecipes from "@/i18n/messages/en/recipes.json";
import nlRecipes from "@/i18n/messages/nl/recipes.json";
import frRecipes from "@/i18n/messages/fr/recipes.json";
import deFormalRecipes from "@/i18n/messages/de-formal/recipes.json";
import deInformalRecipes from "@/i18n/messages/de-informal/recipes.json";

const FUZZY_THRESHOLD = 0.4;

type RecipeCategoryKey = "breakfast" | "lunch" | "dinner" | "snack";

type RecipesMessageSubset = {
  form?: {
    category?: Partial<Record<RecipeCategoryKey, string>>;
  };
};

type CategoryEntry = {
  category: RecipeCategory;
  synonyms: string[];
};

const RECIPES_MESSAGE_BUNDLES: RecipesMessageSubset[] = [
  enRecipes as RecipesMessageSubset,
  nlRecipes as RecipesMessageSubset,
  frRecipes as RecipesMessageSubset,
  deFormalRecipes as RecipesMessageSubset,
  deInformalRecipes as RecipesMessageSubset,
];

const CATEGORY_MESSAGE_KEYS: Record<RecipeCategory, RecipeCategoryKey> = {
  Breakfast: "breakfast",
  Lunch: "lunch",
  Dinner: "dinner",
  Snack: "snack",
};

const BASE_SYNONYMS: Record<RecipeCategory, string[]> = {
  Breakfast: ["breakfast", "brunch", "morning meal"],
  Lunch: ["lunch", "midday meal"],
  Dinner: ["dinner", "diner", "supper", "main course", "main dish", "entree", "entrée"],
  Snack: ["snack", "appetizer", "dessert", "starter", "side", "side dish"],
};

function normalizeCategoryText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getLocalizedCategorySynonyms(category: RecipeCategory): string[] {
  const categoryKey = CATEGORY_MESSAGE_KEYS[category];

  return RECIPES_MESSAGE_BUNDLES.map((bundle) => bundle.form?.category?.[categoryKey] ?? "")
    .map((label) => label.trim())
    .filter((label): label is string => label.length > 0);
}

const CATEGORY_DATA: CategoryEntry[] = (
  ["Breakfast", "Lunch", "Dinner", "Snack"] as RecipeCategory[]
).map((category) => {
  const allSynonyms = [...BASE_SYNONYMS[category], ...getLocalizedCategorySynonyms(category)].map(
    normalizeCategoryText
  );

  return {
    category,
    synonyms: Array.from(new Set(allSynonyms)).filter((synonym) => synonym.length > 0),
  };
});

const EXACT_MATCH_MAP = new Map<string, RecipeCategory>();

for (const entry of CATEGORY_DATA) {
  for (const synonym of entry.synonyms) {
    if (!EXACT_MATCH_MAP.has(synonym)) {
      EXACT_MATCH_MAP.set(synonym, entry.category);
    }
  }
}

const FUSE_OPTIONS: IFuseOptions<CategoryEntry> = {
  keys: ["synonyms"],
  threshold: FUZZY_THRESHOLD,
  minMatchCharLength: 2,
  ignoreLocation: true,
  ignoreFieldNorm: true,
  includeScore: true,
};

const categoryFuse = new Fuse(CATEGORY_DATA, FUSE_OPTIONS);

function matchCategoryFromContainedPhrase(normalizedInput: string): RecipeCategory | null {
  const paddedInput = ` ${normalizedInput} `;

  for (const entry of CATEGORY_DATA) {
    for (const synonym of entry.synonyms) {
      if (paddedInput.includes(` ${synonym} `)) {
        return entry.category;
      }
    }
  }

  return null;
}

export function matchCategory(input: string): RecipeCategory | null {
  if (!input || typeof input !== "string") return null;

  const normalized = normalizeCategoryText(input);

  if (!normalized) return null;

  const exactMatch = EXACT_MATCH_MAP.get(normalized);

  if (exactMatch) return exactMatch;

  const containedPhraseMatch = matchCategoryFromContainedPhrase(normalized);

  if (containedPhraseMatch) return containedPhraseMatch;

  const results = categoryFuse.search(normalized);

  if (results.length === 0) return null;

  const bestMatch = results[0];

  if (bestMatch.score !== undefined && bestMatch.score > FUZZY_THRESHOLD) {
    return null;
  }

  return bestMatch.item.category;
}
