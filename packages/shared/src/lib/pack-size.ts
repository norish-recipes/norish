/**
 * The Pack Size: what one Shelf Price buys, read out of the shop's own size
 * words — "500 g", "6 x 33 cl", "10 stuks", "per kg" — or out of the
 * quantity and unit code a shop's data states. "ca." is the number it
 * prefixes: there is no tolerance, because a strict Pack Size is what the
 * Line Cost rounds against (ADR-0029).
 */
import type { UnitId } from "./units";
import { isUnitId, resolveUnit, resolveUnitCode } from "./units";

export interface PackSize {
  quantity: number;
  unit: UnitId;
  /** Sold loose: the Shelf Price is what `quantity` of `unit` costs, and any amount of it is bought. */
  byWeight: boolean;
}

/** `1,5` and `1.5` are one number; `1.234,56` is not a pack size anyone prints. */
function readNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value.replace(",", "."));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** `per kg`, `per 100 gram`, `/ kg`, `Per stuk`: a unit of sale, with the quantity it is sold by. */
const PER_UNIT =
  /^(?:per|\/|pro|par|por|al|za|à|pr\.?)\s*(\d+(?:[.,]\d+)?)?\s*(\p{L}[\p{L}. ]*?)\.?$/iu;

/** `(ca.)? N (x M)? unit`, with a parenthetical the shop adds after it left alone. */
const MEASURE =
  /^(?:ca\.?|approx\.?|circa|±|~)?\s*(\d+(?:[.,]\d+)?)\s*(?:[x×*]\s*(\d+(?:[.,]\d+)?)\s*)?(\p{L}[\p{L}. ]*?)\.?(?:\s*\([^)]*\))?$/iu;

function collapse(words: string): string {
  return words.replace(/\s+/g, " ").trim();
}

/**
 * The Pack Size a shop's size words state, or null where the words state
 * none the table can read: "Tros", "per pakket", a bare number. A container
 * word is no Pack Size either — "2 pak" is a number of packs, not what one
 * pack holds.
 */
export function readPackSize(words: string | null | undefined): PackSize | null {
  if (!words) return null;
  const text = collapse(words);

  if (!text) return null;

  const perUnit = PER_UNIT.exec(text);

  if (perUnit) {
    const unit = resolveUnit(perUnit[2]);

    if (!unit || unit.family === "pack") return null;
    const quantity = readNumber(perUnit[1]) ?? 1;

    return { quantity, unit: unit.id, byWeight: unit.family !== "count" };
  }

  const measure = MEASURE.exec(text);

  if (!measure) return null;
  const unit = resolveUnit(measure[3]);

  if (!unit || unit.family === "pack") return null;
  const count = readNumber(measure[1]);
  const each = measure[2] === undefined ? 1 : readNumber(measure[2]);

  if (count === null || each === null) return null;

  return { quantity: round(count * each), unit: unit.id, byWeight: false };
}

/** The Pack Size a shop's data states as a quantity and a unit code, or a unit written out. */
export function packSizeFromCode(
  quantity: number | string | null | undefined,
  code: string | null | undefined
): PackSize | null {
  const unit = resolveUnitCode(code);

  if (!unit || unit.family === "pack") return null;
  const amount = typeof quantity === "number" ? quantity : readNumber(quantity ?? undefined);

  if (amount === null || !Number.isFinite(amount) || amount <= 0) return null;

  return { quantity: round(amount), unit: unit.id, byWeight: false };
}

/** Floating point makes 6 × 0.33 into 1.9800000000000002; a pack is stated to three decimals at most. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The Pack Size a Store Product carries, as the three columns it is stored in. */
export function packSizeOf(product: {
  packQuantity: number | null;
  packUnit: string | null;
  packByWeight: boolean;
}): PackSize | null {
  if (product.packQuantity === null || product.packUnit === null) return null;
  if (!isUnitId(product.packUnit) || product.packQuantity <= 0) return null;

  return { quantity: product.packQuantity, unit: product.packUnit, byWeight: product.packByWeight };
}
