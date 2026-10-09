/**
 * Converting a recipe's measurements between metric and US without a
 * language model (#599). A weight becomes a weight and a volume a volume, by
 * the unit table's own sizes, except where the food decides otherwise:
 *
 * - to metric, a cup of a food that is not poured is weighed through its
 *   density, so "2 cups flour" is 250 g while "1 cup milk" stays 240 ml;
 * - to US, a weight of a poured food, or a spoonful's weight of anything, is
 *   measured through its density, so "200 g milk" is ¾ cup and "5 g salt"
 *   ¾ tsp, while "500 g beef" stays a weight: 1 lb.
 *
 * Spoons belong to both systems and stay as written. Every result is rounded
 * to what a kitchen measures: 5 g, ¼ cup, ½ tbsp. Step text gets its oven
 * temperatures and its plain measures converted the same way, with no food
 * to go on.
 */
import type { MeasurementSystem } from "@norish/shared/contracts";

import type { UnitId } from "./units";
import { formatAmountAsDecimal, formatAmountAsFraction } from "./format-amount";
import { resolveUnit, unitById } from "./units";

/** What a line's food tells a conversion: grams per millilitre, and whether it is poured. */
export interface FoodMeasure {
  density: number | null;
  poured: boolean;
}

/** An amount in a unit as a recipe line stores it: a units-map id, or "kg". */
export interface Measure {
  amount: number;
  unit: string;
}

const SPOONS: ReadonlySet<UnitId> = new Set(["teaspoon", "tablespoon"]);

const METRIC_UNITS: ReadonlySet<UnitId> = new Set([
  "gram",
  "kilogram",
  "milligram",
  "milliliter",
  "centiliter",
  "deciliter",
  "liter",
]);

/** The volume below which a weight converted to US is spooned rather than weighed: ¼ cup. */
const SPOONFUL_ML = 60;

const OUNCE = unitById("ounce").magnitude;

function roundTo(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(3));
}

function metric(base: number, unit: "gram" | "milliliter"): Measure {
  if (base >= 1000) {
    return { amount: roundTo(base / 1000, 0.01), unit: unit === "gram" ? "kg" : "liter" };
  }

  return {
    amount: base < 10 ? roundTo(base, 0.1) : base < 100 ? Math.round(base) : roundTo(base, 5),
    unit,
  };
}

function usVolume(ml: number): Measure {
  if (ml < 15) return { amount: Math.max(roundTo(ml / 5, 0.25), 0.125), unit: "teaspoon" };
  if (ml < SPOONFUL_ML) return { amount: roundTo(ml / 15, 0.5), unit: "tablespoon" };

  const cups = ml / 240;

  if (cups >= 4) return { amount: roundTo(cups, 0.5), unit: "cup" };

  const quarters = roundTo(cups, 0.25);
  const thirds = roundTo(cups, 1 / 3);

  return {
    amount: Math.abs(thirds - cups) < Math.abs(quarters - cups) ? thirds : quarters,
    unit: "cup",
  };
}

/** A weight in ounces or pounds; null under half an ounce, which no ounce says honestly. */
function usMass(grams: number): Measure | null {
  const ounces = grams / OUNCE;

  if (ounces < 0.5) return null;
  if (ounces >= 16) return { amount: roundTo(ounces / 16, 0.25), unit: "pound" };

  return { amount: ounces < 1 ? roundTo(ounces, 0.25) : roundTo(ounces, 0.5), unit: "ounce" };
}

/**
 * An amount in a unit, converted to the target system; null where it stays
 * as written: a spoon, a unit already in the target system, anything that is
 * not a weight or a volume, or a few grams of a food with no density to
 * spoon it by.
 */
export function convertMeasure(
  amount: number,
  unitWord: string,
  target: MeasurementSystem,
  food?: FoodMeasure | null
): Measure | null {
  const unit = resolveUnit(unitWord);

  if (!(amount > 0) || !unit || SPOONS.has(unit.id)) return null;

  const isMetric = METRIC_UNITS.has(unit.id);

  if (target === "metric" ? isMetric : !isMetric) return null;

  const base = amount * unit.magnitude;
  const density = food?.density ?? null;

  if (unit.family === "volume") {
    if (target === "us") return usVolume(base);

    return density && !food?.poured ? metric(base * density, "gram") : metric(base, "milliliter");
  }

  if (unit.family !== "mass") return null;
  if (target === "metric") return metric(base, "gram");

  const ml = density ? base / density : null;

  return ml !== null && (food?.poured || ml < SPOONFUL_ML) ? usVolume(ml) : usMass(base);
}

const LABELS: Record<string, [one: string, many: string]> = {
  gram: ["g", "g"],
  kg: ["kg", "kg"],
  milliliter: ["ml", "ml"],
  liter: ["l", "l"],
  ounce: ["oz", "oz"],
  pound: ["lb", "lb"],
  cup: ["cup", "cups"],
  tablespoon: ["tbsp", "tbsp"],
  teaspoon: ["tsp", "tsp"],
};

const VULGAR: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅛": 0.125,
};

/** "2", "1.5", "1,5", "1/2", "1 1/2", "½" and "1½". */
const NUMBER = String.raw`\d+\s\d+\/\d+|\d+\/\d+|\d*[½⅓⅔¼¾⅛]|\d+(?:[.,]\d+)?`;

/**
 * A number and the word or two after it, never part of a range ("2-3 cups")
 * or of a longer number. Whether the words are a unit is the unit table's
 * call, so "2 cm" and "5 minutes" stay as written.
 */
const MEASURE = new RegExp(
  String.raw`(?<![\d.,/\-–])(${NUMBER})\s?(\p{L}+)(?:(\.?\s?)(\p{L}+))?`,
  "gu"
);

/** "350°F", "350 °F", "350 degrees F", "350 degrees", "350°" and "350F". */
const TEMPERATURE =
  /(?<!\d)(\d{2,3})\s?(?:(?:°|º|degrees?)(?:\s?(Fahrenheit|Celsius|F|C)\b)?|(F|C)\b)/g;

function parseNumber(text: string): number {
  return text.split(/\s+/).reduce((sum, part) => {
    const vulgar = VULGAR[part.slice(-1)];

    if (vulgar !== undefined) return sum + Number(part.slice(0, -1) || 0) + vulgar;

    const [numerator, denominator] = part.split("/");

    return sum + Number(numerator!.replace(",", ".")) / Number(denominator ?? 1);
  }, 0);
}

function written({ amount, unit }: Measure, target: MeasurementSystem): string {
  const number = target === "us" ? formatAmountAsFraction(amount) : formatAmountAsDecimal(amount);
  const [one, many] = LABELS[unit] ?? [unit, unit];

  return `${number} ${amount > 1 ? many : one}`;
}

/**
 * A temperature with no scale is in the scale the recipe is converted from:
 * "350 degrees" in a US recipe is Fahrenheit, "200°" in a metric one Celsius.
 * Oven temperatures land on the steps an oven dial has.
 */
function convertTemperatures(text: string, target: MeasurementSystem): string {
  const source = target === "metric" ? "F" : "C";

  return text.replace(TEMPERATURE, (match, degrees: string, named?: string, letter?: string) => {
    if ((named ?? letter ?? source)[0] !== source) return match;

    const value = Number(degrees);

    return target === "metric"
      ? `${roundTo(((value - 32) * 5) / 9, 5)}°C`
      : `${roundTo((value * 9) / 5 + 32, value >= 120 ? 25 : 5)}°F`;
  });
}

/** A step's text with its temperatures and plain measures in the target system. */
export function convertStepText(text: string, target: MeasurementSystem): string {
  return convertTemperatures(text, target).replace(
    MEASURE,
    (match, number: string, word: string, gap?: string, next?: string) => {
      const amount = parseNumber(number);
      const twoWords = next ? convertMeasure(amount, `${word}${gap}${next}`, target) : null;

      if (twoWords) return written(twoWords, target);

      const oneWord = convertMeasure(amount, word, target);

      return oneWord ? `${written(oneWord, target)}${next ? `${gap}${next}` : ""}` : match;
    }
  );
}
