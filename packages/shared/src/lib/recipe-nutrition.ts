/**
 * A recipe's worked-out nutrition (ADR-0039): its lines' Ingredient
 * Nutrition, summed and divided by its servings, for a recipe that supplies
 * none of its own. Pure arithmetic over what the server resolved for the
 * reader's household, and nothing cleverer:
 *
 * - a weight line converts directly;
 * - a counted line (no unit, a piece, a clove, a slice) goes through the
 *   Ingredient's piece weight;
 * - a volume line (ml, a teaspoon of 5, a tablespoon of 15, a cup of 240,
 *   the unit table's own sizes) goes through its density, never water's;
 * - a pinch, a dash or "to taste" counts as nothing and is not listed;
 * - anything else, a missing amount or missing numbers leaves the line out
 *   of the total, named beneath it.
 *
 * A total that borrowed anywhere is estimated; one no line counted toward
 * is none at all, never a misleading zero.
 *
 * On an instance with AI, the language model may have estimated the lines
 * left out (ADR-0039, ticket 12): one share per line, stored apart under the
 * line's key. A line still left out takes its share, so a household whose
 * own correction counts one of those lines keeps the model's numbers for
 * the others. The total is then estimated, and those lines are named as the
 * model's rather than as not counted.
 */
import type { UnitsMap } from "@norish/config/zod/server-config";
import type {
  IngredientNutrition,
  NutritionCredit,
  NutritionFact,
} from "@norish/shared/contracts/ingredient-nutrition";
import { creditOf, NUTRITION_CREDITS } from "@norish/shared/contracts/ingredient-nutrition";
import { foldName } from "@norish/shared/lib/fold-name";

import { resolveUnit } from "./units";

/** What the arithmetic needs of a recipe: its servings, its stored nutrition, its lines. */
export interface RecipeForNutrition {
  servings: number | null;
  systemUsed: string;
  calories: number | null;
  fat: number | string | null;
  carbs: number | string | null;
  protein: number | string | null;
  recipeIngredients: ReadonlyArray<{
    id?: string;
    ingredientName: string;
    ingredientId: string | null;
    amount: number | string | null;
    unit: string | null;
    systemUsed: string;
  }>;
  /** The language model's stored estimate of the lines left out, where the recipe travels with it. */
  nutritionEstimate?: NutritionGapEstimate | null;
}

/**
 * Whether a recipe stores Nutrition Information of its own: any substantive
 * value makes the group authoritative, and nothing is worked out beside it.
 */
export function suppliesNutrition(recipe: RecipeForNutrition): boolean {
  return [recipe.calories, recipe.fat, recipe.carbs, recipe.protein].some(
    (value) => value !== null && value !== "" && Number.isFinite(Number(value))
  );
}

/**
 * The lines a total is worked out from: the ones in the recipe's own
 * measurement system (a recipe may keep a converted copy of each), without
 * the `#` headings.
 */
export function nutritionLinesOf(recipe: RecipeForNutrition): NutritionLine[] {
  const own = recipe.recipeIngredients.filter((line) => line.systemUsed === recipe.systemUsed);

  return (own.length > 0 ? own : recipe.recipeIngredients)
    .filter((line) => !line.ingredientName.trim().startsWith("#"))
    .map((line, index) => ({
      id: line.id ?? `line-${index}`,
      name: line.ingredientName,
      amount: line.amount === null || line.amount === "" ? null : Number(line.amount),
      unit: line.unit,
      ingredientId: line.ingredientId,
    }));
}

/** One recipe line, as the arithmetic reads it. */
export interface NutritionLine {
  id: string;
  /** The line's text as written, for naming it under the total. */
  name: string;
  amount: number | null;
  /** The unit as the line stores it: a units-map id ("tablespoon", "clove", "to_taste") or a spelling. */
  unit: string | null;
  ingredientId: string | null;
}

/** Calories and macros per serving. */
export interface NutritionPerServing {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

/** A line named under a total: left out of it, or estimated by the language model. */
export interface NamedLine {
  lineId: string;
  name: string;
  ingredientId: string | null;
  /** The line as an estimate recognises it again (`lineKey`). */
  key: string;
}

/** A line the total counted, with what it brought, for the whole line rather than per serving. */
export interface CountedLine {
  lineId: string;
  name: string;
  grams: number;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

/** The language model's per-serving share of one line left out, under the line's `lineKey`. */
export interface EstimatedLine {
  key: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

/** The language model's estimate of the lines a worked-out total left out: one share per line. */
export interface NutritionGapEstimate {
  lines: EstimatedLine[];
}

export interface WorkedOutNutrition {
  /** Null where no line counted toward a total. */
  perServing: NutritionPerServing | null;
  /** The lines left out of the total, in the recipe's order. */
  uncounted: NamedLine[];
  /** The lines the language model's estimate covers, in the recipe's order. */
  estimatedByAI: NamedLine[];
  /** The lines the total counted. */
  counted: CountedLine[];
  /** Whether a counted line borrowed a fact from a parent food. */
  estimated: boolean;
  /** The datasets the counted lines took a fact from, in a fixed order. */
  credits: NutritionCredit[];
  /** Whether a counted line took a fact from the household's own correction. */
  household: boolean;
}

/** The units-map entries that measure seasoning: counted as nothing, and never listed. */
const SEASONING_UNITS = ["pinch", "dash", "to_taste"] as const;

/** The units counted in pieces besides the unit table's own: a garlic's clove, a bread's slice. */
const PIECE_UNITS = new Set(["clove", "cloves", "slice", "slices"]);

/**
 * The phrases of those entries, folded: what marks a line written without a
 * unit as seasoning ("salt to taste", "a pinch of nutmeg").
 */
export function seasoningPhrases(units: UnitsMap | null | undefined): string[] {
  const phrases = new Set<string>();

  for (const id of SEASONING_UNITS) {
    const unit = units?.[id];

    for (const name of [
      id.replace(/_/g, " "),
      ...(unit?.short ?? []).map((form) => form?.name),
      ...(unit?.plural ?? []).map((form) => form?.name),
      ...(unit?.alternates ?? []),
    ]) {
      const fold = foldName(name);

      if (fold.length > 1) phrases.add(fold);
    }
  }

  return [...phrases];
}

/**
 * A line as a stored estimate recognises it again: its food (or text), its
 * amount and its unit. An edit to any of them makes it another line.
 */
export function lineKey(
  line: Pick<NutritionLine, "name" | "amount" | "unit" | "ingredientId">
): string {
  return JSON.stringify([line.ingredientId ?? foldName(line.name), line.amount, line.unit ?? null]);
}

function isSeasoning(line: NutritionLine, seasoning: readonly string[]): boolean {
  if (line.unit && (SEASONING_UNITS as readonly string[]).includes(line.unit)) return true;
  if (line.amount !== null && line.unit) return false;

  const name = foldName(line.name);

  return seasoning.some(
    (phrase) => name.startsWith(`${phrase} `) || name.endsWith(` ${phrase}`) || name === phrase
  );
}

/** What one line weighs, and the facts it took to know: null where it cannot be known. */
function gramsOf(
  line: NutritionLine,
  nutrition: IngredientNutrition
): { grams: number; through: NutritionFact<number> | null } | null {
  const { amount } = line;

  if (amount === null || !(amount > 0)) return null;

  const unit = line.unit ? resolveUnit(line.unit) : null;

  if (!line.unit || unit?.family === "count" || PIECE_UNITS.has(line.unit.toLowerCase())) {
    const pieces = amount * (unit?.magnitude ?? 1);

    return nutrition.pieceWeight
      ? { grams: pieces * nutrition.pieceWeight.value, through: nutrition.pieceWeight }
      : null;
  }
  if (unit?.family === "mass") return { grams: amount * unit.magnitude, through: null };
  if (unit?.family === "volume") {
    return nutrition.density
      ? { grams: amount * unit.magnitude * nutrition.density.value, through: nutrition.density }
      : null;
  }

  return null;
}

export function workOutNutrition({
  lines,
  servings,
  nutrition,
  seasoning,
  estimate = null,
}: {
  lines: readonly NutritionLine[];
  servings: number | null;
  nutrition: ReadonlyMap<string, IngredientNutrition>;
  /** `seasoningPhrases` of the units map. */
  seasoning: readonly string[];
  /** The language model's stored share of the lines left out, if any. */
  estimate?: NutritionGapEstimate | null;
}): WorkedOutNutrition {
  const total = { calories: 0, fat: 0, carbs: 0, protein: 0 };
  const uncounted: NamedLine[] = [];
  const counted: CountedLine[] = [];
  const credits = new Set<NutritionCredit>();
  let estimated = false;
  let household = false;

  for (const line of lines) {
    if (isSeasoning(line, seasoning)) continue;

    const facts = line.ingredientId ? nutrition.get(line.ingredientId) : undefined;
    const weighed = facts?.numbers ? gramsOf(line, facts) : null;

    if (!facts?.numbers || !weighed) {
      uncounted.push({
        lineId: line.id,
        name: line.name,
        ingredientId: line.ingredientId,
        key: lineKey(line),
      });
      continue;
    }

    const share = weighed.grams / 100;
    const used = [facts.numbers, ...(weighed.through ? [weighed.through] : [])];
    const brought = {
      calories: facts.numbers.value.kcal * share,
      fat: facts.numbers.value.fat * share,
      carbs: facts.numbers.value.carbs * share,
      protein: facts.numbers.value.protein * share,
    };

    total.calories += brought.calories;
    total.fat += brought.fat;
    total.carbs += brought.carbs;
    total.protein += brought.protein;
    counted.push({ lineId: line.id, name: line.name, grams: weighed.grams, ...brought });
    for (const fact of used) {
      const credit = creditOf(fact.source);

      if (credit) credits.add(credit);
      else household = true;
      if (fact.borrowedFrom) estimated = true;
    }
  }

  const divisor = servings && servings > 0 ? servings : 1;
  const perServing =
    counted.length > 0
      ? {
          calories: total.calories / divisor,
          fat: total.fat / divisor,
          carbs: total.carbs / divisor,
          protein: total.protein / divisor,
        }
      : null;
  // Each line still left out takes the model's stored share of it, if there
  // is one. A line a household's own correction made countable simply counts;
  // the other lines keep their shares, and a line the share never covered,
  // or one edited since, stays listed as not counted.
  const shareOf = new Map((estimate?.lines ?? []).map((line) => [line.key, line]));
  const estimatedByAI = uncounted.filter((line) => shareOf.has(line.key));

  if (estimatedByAI.length > 0) {
    const share = { calories: 0, fat: 0, carbs: 0, protein: 0 };

    for (const line of estimatedByAI) {
      const stored = shareOf.get(line.key)!;

      share.calories += stored.calories;
      share.fat += stored.fat;
      share.carbs += stored.carbs;
      share.protein += stored.protein;
    }

    return {
      perServing: {
        calories: (perServing?.calories ?? 0) + share.calories,
        fat: (perServing?.fat ?? 0) + share.fat,
        carbs: (perServing?.carbs ?? 0) + share.carbs,
        protein: (perServing?.protein ?? 0) + share.protein,
      },
      uncounted: uncounted.filter((line) => !shareOf.has(line.key)),
      estimatedByAI,
      counted,
      estimated: true,
      credits: NUTRITION_CREDITS.filter((credit) => credits.has(credit)),
      household,
    };
  }

  return {
    perServing,
    uncounted,
    estimatedByAI: [],
    counted,
    estimated,
    credits: NUTRITION_CREDITS.filter((credit) => credits.has(credit)),
    household,
  };
}
