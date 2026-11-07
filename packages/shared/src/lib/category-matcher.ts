import arRecipes from "@norish/i18n/messages/ar/recipes.json" with { type: "json" };
import bgRecipes from "@norish/i18n/messages/bg/recipes.json" with { type: "json" };
import daRecipes from "@norish/i18n/messages/da/recipes.json" with { type: "json" };
import deFormalRecipes from "@norish/i18n/messages/de-formal/recipes.json" with { type: "json" };
import deInformalRecipes from "@norish/i18n/messages/de-informal/recipes.json" with { type: "json" };
import enRecipes from "@norish/i18n/messages/en/recipes.json" with { type: "json" };
import esRecipes from "@norish/i18n/messages/es/recipes.json" with { type: "json" };
import fiRecipes from "@norish/i18n/messages/fi/recipes.json" with { type: "json" };
import frRecipes from "@norish/i18n/messages/fr/recipes.json" with { type: "json" };
import itRecipes from "@norish/i18n/messages/it/recipes.json" with { type: "json" };
import koRecipes from "@norish/i18n/messages/ko/recipes.json" with { type: "json" };
import nlRecipes from "@norish/i18n/messages/nl/recipes.json" with { type: "json" };
import noRecipes from "@norish/i18n/messages/no/recipes.json" with { type: "json" };
import plRecipes from "@norish/i18n/messages/pl/recipes.json" with { type: "json" };
import ptBRRecipes from "@norish/i18n/messages/pt-BR/recipes.json" with { type: "json" };
import ruRecipes from "@norish/i18n/messages/ru/recipes.json" with { type: "json" };
import svRecipes from "@norish/i18n/messages/sv/recipes.json" with { type: "json" };
import ukRecipes from "@norish/i18n/messages/uk/recipes.json" with { type: "json" };

import type { BuiltInCategory } from "./categories";
import { BUILT_IN_CATEGORIES } from "./categories";
import { editDistance } from "./cuisine-resolver";

type BuiltInCategoryKey = "breakfast" | "lunch" | "dinner" | "snack";

type RecipesMessageSubset = {
  form?: {
    category?: Partial<Record<BuiltInCategoryKey, string>>;
  };
};

const ALL_LOCALE_BUNDLES: RecipesMessageSubset[] = [
  arRecipes,
  bgRecipes,
  daRecipes,
  deFormalRecipes,
  deInformalRecipes,
  enRecipes,
  esRecipes,
  fiRecipes,
  frRecipes,
  itRecipes,
  koRecipes,
  nlRecipes,
  noRecipes,
  plRecipes,
  ptBRRecipes,
  ruRecipes,
  svRecipes,
  ukRecipes,
];

const CATEGORY_MESSAGE_KEYS: Record<BuiltInCategory, BuiltInCategoryKey> = {
  Breakfast: "breakfast",
  Lunch: "lunch",
  Dinner: "dinner",
  Snack: "snack",
};

const BASE_SYNONYMS: Record<BuiltInCategory, string[]> = {
  Breakfast: ["breakfast", "brunch", "morning meal"],
  Lunch: ["lunch", "midday meal"],
  Dinner: ["dinner", "diner", "supper", "main course", "main dish", "entree", "entrée"],
  Snack: ["snack", "appetizer", "dessert", "starter", "side", "side dish"],
};

// Unicode-aware, so Cyrillic, Hangul and Arabic names survive.
function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Each built-in's name and its translation in every locale, in one walk.
const BUILT_IN_NAMES = BUILT_IN_CATEGORIES.flatMap((category) =>
  [category, ...ALL_LOCALE_BUNDLES.map((b) => b.form?.category?.[CATEGORY_MESSAGE_KEYS[category]])]
    .filter((name): name is string => Boolean(name))
    .map((name) => [name, category] as const)
);

// Normalised term to built-in; null for a term two sources give to different built-ins.
type TermTable = Map<string, BuiltInCategory | null>;

function termTable(pairs: readonly (readonly [string, BuiltInCategory])[]): TermTable {
  const table: TermTable = new Map();

  for (const [name, category] of pairs) {
    const term = normalizeName(name);
    const seen = table.get(term);

    if (term) table.set(term, seen === undefined || seen === category ? category : null);
  }

  return table;
}

const BUILT_IN_BY_NAME = termTable(BUILT_IN_NAMES);

const MATCH_TERMS = termTable([
  ...BUILT_IN_NAMES,
  ...BUILT_IN_CATEGORIES.flatMap((category) =>
    BASE_SYNONYMS[category].map((synonym) => [synonym, category] as const)
  ),
]);

// A term, or a term plus "s"; undefined when the table does not know it.
function lookupTerm(table: TermTable, term: string): BuiltInCategory | null | undefined {
  if (table.has(term)) return table.get(term);

  return term.endsWith("s") ? table.get(term.slice(0, -1)) : undefined;
}

function matchCategoryFromContainedPhrase(normalizedInput: string): BuiltInCategory | null {
  const paddedInput = ` ${normalizedInput} `;

  for (const [term, category] of MATCH_TERMS) {
    if (category && paddedInput.includes(` ${term} `)) return category;
  }

  return null;
}

// A typo of a whole term: one edit, four letters or more, same first letter, so
// "breakfst" matches but "bread", "inner" and "pie" do not.
function matchCategoryByTypo(normalizedInput: string): BuiltInCategory | null {
  if (normalizedInput.length < 4) return null;

  for (const [term, category] of MATCH_TERMS) {
    if (category && term[0] === normalizedInput[0] && editDistance(normalizedInput, term) <= 1) {
      return category;
    }
  }

  return null;
}

/** A source's category name to a built-in by name, synonym, contained word or typo. */
export function matchCategory(input: string): BuiltInCategory | null {
  const normalized = normalizeName(input);

  if (!normalized) return null;

  const exact = lookupTerm(MATCH_TERMS, normalized);

  if (exact !== undefined) return exact;

  return matchCategoryFromContainedPhrase(normalized) ?? matchCategoryByTypo(normalized);
}

/**
 * The built-in a person-given name means: its name, its translation in any
 * locale, or either plus "s", ignoring case and accents. No synonyms or fuzz.
 */
export function resolveBuiltInCategory(input: string): BuiltInCategory | null {
  return lookupTerm(BUILT_IN_BY_NAME, normalizeName(input)) ?? null;
}

/**
 * The import rule for another app's category names (ADR-0040): a household
 * Category by exact name, else a built-in through `match`, else a Tag.
 */
export function sortSourceCategories(
  names: readonly string[],
  household: readonly string[],
  match: (name: string) => BuiltInCategory | null = matchCategory
): { categories: string[]; tags: string[] } {
  const byLower = new Map(household.map((name) => [name.toLowerCase(), name]));
  const categories = new Set<string>();
  const tags = new Map<string, string>();

  for (const name of names.map((n) => n.trim()).filter(Boolean)) {
    const category = byLower.get(name.toLowerCase()) ?? match(name);

    if (category) categories.add(category);
    else if (!tags.has(name.toLowerCase())) tags.set(name.toLowerCase(), name);
  }

  return { categories: [...categories], tags: [...tags.values()] };
}
