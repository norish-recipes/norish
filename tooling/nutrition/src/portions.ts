import { round } from "./read/values";

/**
 * A USDA portion: so many of a household measure weigh so many grams. SR
 * Legacy names the measure in `modifier` ("medium (2-1/2" dia)", "cup,
 * chopped"); Foundation Foods names it by a measure unit, with a modifier
 * beside it.
 */
export interface Portion {
  amount: number;
  /** The measure unit's name, "" where USDA left it undetermined. */
  unit: string;
  modifier: string;
  grams: number;
}

const VOLUME_ML: ReadonlyArray<readonly [RegExp, number]> = [
  [/^cups?\b/, 240],
  [/^(tbsp|tablespoons?)\b/, 15],
  [/^(tsp|teaspoons?)\b/, 5],
  [/^(fl oz|fluid ounces?)\b/, 29.5735],
  [/^(ml|milliliters?|millilitres?)\b/, 1],
];

/** Words a portion is measured in that make it no piece: a weight, a volume, a pack, a serving. */
const NOT_A_PIECE =
  /^(cups?|tbsp|tablespoons?|tsp|teaspoons?|fl oz|fluid|ml|milliliters?|millilitres?|liters?|litres?|pints?|quarts?|gallons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|serving|servings|nlea|package|packages|pkg|container|containers|bag|bags|box|boxes|can|cans|jar|jars|bottle|bottles|cubic|paired|dripping|portion|recipe|batch|yield|tray|pie|cake)\b/;

/** A portion's measure as words: its unit's name, then its modifier. */
function label(portion: Portion): string {
  const unit = portion.unit === "undetermined" ? "" : portion.unit;

  return `${unit} ${portion.modifier}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function perOne(portion: Portion): number | null {
  if (!(portion.amount > 0) || !(portion.grams > 0)) return null;

  return round(portion.grams / portion.amount);
}

/**
 * What one piece weighs (ADR-0039): a "medium" or "whole" portion, else the
 * first portion counted in pieces ("clove", "slice", "large"), else none.
 */
export function pieceWeightOf(portions: readonly Portion[]): number | null {
  const counted = portions.filter((portion) => {
    const words = label(portion);

    return words !== "" && !NOT_A_PIECE.test(words);
  });
  const typical = counted.find((portion) => /^(medium|whole)\b/.test(label(portion)));

  for (const portion of typical ? [typical, ...counted] : counted) {
    const grams = perOne(portion);

    if (grams !== null) return grams;
  }

  return null;
}

/**
 * Whether a portion measures the food whipped ("cup, whipped"): air, not the
 * food a recipe pours. A note in brackets does not count, so "cup, fluid
 * (yields 2 cups whipped)" is the cream as poured.
 */
function isWhipped(portion: Portion): boolean {
  return /\bwhipped\b/.test(label(portion).replace(/\([^)]*\)/g, ""));
}

/**
 * A measure's portions, a whole one before any fraction of it: USDA rounds
 * some fractions ("0.2 cup" for a quarter), and a whole measure is weighed
 * as it is.
 */
function wholeFirst(portions: readonly Portion[]): Portion[] {
  return [
    ...portions.filter((portion) => portion.amount === 1),
    ...portions.filter((portion) => portion.amount !== 1),
  ];
}

/**
 * Grams per millilitre (ADR-0039): from a cup portion, else a tablespoon,
 * else a teaspoon, else a fluid ounce or millilitre; the plain measure ("cup")
 * before one of the food cut some way ("cup, chopped"), a whole measure
 * before a fraction of it, and never one of it whipped. Water is never
 * assumed.
 */
export function densityOf(portions: readonly Portion[]): number | null {
  for (const [measure, ml] of VOLUME_ML) {
    const matching = portions.filter(
      (portion) => measure.test(label(portion)) && !isWhipped(portion)
    );
    const plain = matching.filter((portion) => !/[,(]/.test(label(portion)));

    for (const portion of [...wholeFirst(plain), ...wholeFirst(matching)]) {
      const grams = perOne(portion);

      if (grams !== null) return round(grams / ml);
    }
  }

  return null;
}
