/**
 * A recipe's worked-out nutrition (ADR-0039): its lines' Ingredient
 * Nutrition, summed and divided by its servings, for a recipe that supplies
 * none of its own. Pure arithmetic over what the server resolved for the
 * reader's household, and nothing cleverer:
 *
 * - a weight line converts directly;
 * - a counted line (no unit, a piece, a clove, a slice, a chunk) goes
 *   through the Ingredient's piece weight;
 * - a volume line (ml, a teaspoon of 5, a tablespoon of 15, a cup of 240,
 *   the unit table's own sizes) goes through its density, never water's;
 * - anything else is left out of the total and named with the one reason
 *   that stopped it, seasoning (a pinch, a dash, "to taste") included:
 *   nothing is left out without the reader knowing.
 *
 * A total is estimated when the lines that borrowed a fact from a parent
 * food bring at least a tenth of its counted calories, so a borrowed
 * teaspoon of paprika leaves it counted; one no line counted toward is none
 * at all, never a misleading zero.
 *
 * On an instance with AI, the language model may have estimated the lines
 * left out (ADR-0039, ticket 12), seasoning excepted: one share per line,
 * stored apart under the line's key. A line still left out takes its share,
 * so a household whose own correction counts one of those lines keeps the
 * model's numbers for the others. The total is then estimated, and those
 * lines are named as the model's.
 */
import type { UnitsMap } from "@norish/config/zod/server-config";
import type {
  IngredientNutrition,
  NutritionCredit,
  NutritionFact,
  Per100g,
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

/**
 * Why a line was left out of a total, the first thing that stopped it:
 * - `seasoning`: a pinch, a dash or "to taste", never counted;
 * - `no-amount`: nothing says how much;
 * - `no-size`: a measure with no size of its own (a can, a handful, a sprig);
 * - `no-numbers`: its food has no numbers, or it names no food at all;
 * - `no-spoon-weight`: measured by volume, and its food has no density;
 * - `no-piece-weight`: counted, and its food has no piece weight.
 */
export type LeftOutReason =
  "seasoning" | "no-amount" | "no-size" | "no-numbers" | "no-spoon-weight" | "no-piece-weight";

/** The reasons whose fix is a fact in the Ingredient's panel: its numbers, a spoon's or a piece's weight. */
export const PANEL_REASONS: ReadonlySet<LeftOutReason> = new Set<LeftOutReason>([
  "no-numbers",
  "no-spoon-weight",
  "no-piece-weight",
]);

/** A line left out of a total, and why; the language model's share may stand in for it. */
export interface LeftOutLine {
  lineId: string;
  name: string;
  ingredientId: string | null;
  /** The line as an estimate recognises it again (`lineKey`). */
  key: string;
  reason: LeftOutReason;
  /** Whether the language model's stored share of the line is in the total. */
  estimatedByAI: boolean;
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
  /** Every line left out of the counted total, in the recipe's order, each with why. */
  leftOut: LeftOutLine[];
  /** The lines the total counted. */
  counted: CountedLine[];
  /**
   * Whether the lines that borrowed a fact from a parent food bring at least
   * a tenth of the counted calories, or the language model estimated a line.
   */
  estimated: boolean;
  /** The datasets the counted lines took a fact from, in a fixed order. */
  credits: NutritionCredit[];
  /** Whether a counted line took a fact from the household's own correction. */
  household: boolean;
}

/** The units-map entries that measure seasoning: never counted, and listed as seasoning. */
const SEASONING_UNITS = ["pinch", "dash", "to_taste"] as const;

/** The share of a total's counted calories the borrowing lines may bring before it is estimated. */
const ESTIMATED_SHARE = 0.1;

/**
 * The units counted in pieces besides the unit table's own: a garlic's
 * clove, a bread's slice, a chunk (which "stuk" was stored as before it
 * named a piece).
 */
const PIECE_UNITS = new Set(["clove", "cloves", "slice", "slices", "chunk", "chunks"]);

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

/**
 * What one line weighs, and the facts it took to know; or the first thing
 * that stopped it: its amount, then its measure, then its food's numbers,
 * then the weight its measure goes through.
 */
function weigh(
  line: NutritionLine,
  facts: IngredientNutrition | undefined
):
  | { grams: number; through: NutritionFact<number> | null; numbers: NutritionFact<Per100g> }
  | { reason: LeftOutReason } {
  const { amount } = line;

  if (amount === null || !(amount > 0)) return { reason: "no-amount" };

  const unit = line.unit ? resolveUnit(line.unit) : null;
  const counted =
    !line.unit || unit?.family === "count" || PIECE_UNITS.has(line.unit.toLowerCase());
  const measured = !counted && (unit?.family === "mass" || unit?.family === "volume") ? unit : null;

  if (!counted && !measured) return { reason: "no-size" };
  if (!facts?.numbers) return { reason: "no-numbers" };

  const { numbers, pieceWeight, density } = facts;

  if (!measured) {
    const pieces = amount * (unit?.magnitude ?? 1);

    return pieceWeight
      ? { grams: pieces * pieceWeight.value, through: pieceWeight, numbers }
      : { reason: "no-piece-weight" };
  }
  if (measured.family === "mass") {
    return { grams: amount * measured.magnitude, through: null, numbers };
  }

  return density
    ? { grams: amount * measured.magnitude * density.value, through: density, numbers }
    : { reason: "no-spoon-weight" };
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
  const leftOut: LeftOutLine[] = [];
  const counted: CountedLine[] = [];
  const credits = new Set<NutritionCredit>();
  let borrowedCalories = 0;
  let household = false;

  for (const line of lines) {
    const weighed: ReturnType<typeof weigh> = isSeasoning(line, seasoning)
      ? { reason: "seasoning" }
      : weigh(line, line.ingredientId ? nutrition.get(line.ingredientId) : undefined);

    if ("reason" in weighed) {
      leftOut.push({
        lineId: line.id,
        name: line.name,
        ingredientId: line.ingredientId,
        key: lineKey(line),
        reason: weighed.reason,
        estimatedByAI: false,
      });
      continue;
    }

    const share = weighed.grams / 100;
    const used = [weighed.numbers, ...(weighed.through ? [weighed.through] : [])];
    const brought = {
      calories: weighed.numbers.value.kcal * share,
      fat: weighed.numbers.value.fat * share,
      carbs: weighed.numbers.value.carbs * share,
      protein: weighed.numbers.value.protein * share,
    };

    total.calories += brought.calories;
    total.fat += brought.fat;
    total.carbs += brought.carbs;
    total.protein += brought.protein;
    counted.push({ lineId: line.id, name: line.name, grams: weighed.grams, ...brought });
    if (used.some((fact) => fact.borrowedFrom)) borrowedCalories += brought.calories;
    for (const fact of used) {
      const credit = creditOf(fact.source);

      if (credit) credits.add(credit);
      else household = true;
    }
  }

  // Each line still left out takes the model's stored share of it, if there
  // is one. A line a household's own correction made countable simply counts;
  // the other lines keep their shares, and a line the share never covered,
  // or one edited since, stays listed as left out. Seasoning is never asked.
  const shareOf = new Map((estimate?.lines ?? []).map((line) => [line.key, line]));
  const share = { calories: 0, fat: 0, carbs: 0, protein: 0 };

  for (const line of leftOut) {
    const stored = line.reason === "seasoning" ? undefined : shareOf.get(line.key);

    if (!stored) continue;
    line.estimatedByAI = true;
    share.calories += stored.calories;
    share.fat += stored.fat;
    share.carbs += stored.carbs;
    share.protein += stored.protein;
  }

  const estimatedByAI = leftOut.some((line) => line.estimatedByAI);
  const divisor = servings && servings > 0 ? servings : 1;
  const perServing =
    counted.length > 0 || estimatedByAI
      ? {
          calories: total.calories / divisor + share.calories,
          fat: total.fat / divisor + share.fat,
          carbs: total.carbs / divisor + share.carbs,
          protein: total.protein / divisor + share.protein,
        }
      : null;

  return {
    perServing,
    leftOut,
    counted,
    estimated:
      estimatedByAI ||
      (borrowedCalories > 0 && borrowedCalories >= ESTIMATED_SHARE * total.calories),
    credits: NUTRITION_CREDITS.filter((credit) => credits.has(credit)),
    household,
  };
}
