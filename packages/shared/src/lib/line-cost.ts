/**
 * The Line Cost: what a Grocery costs at its Store, as the arithmetic a till
 * does and nothing cleverer. As many whole packs as the amount needs at the
 * Shelf Price, rounded up strictly; a bare number is a number of packs unless
 * the shop counts the pack in pieces, in which case it is a number of
 * pieces; what is sold loose is priced by weight, proportionally. A line the
 * arithmetic cannot do costs one pack and says so — a linked product priced
 * at nothing reads as a bug (ADR-0029).
 */
import type { PackSize } from "./pack-size";
import type { UnitFamily } from "./units";
import { resolveUnit } from "./units";

/** A grocery's own amount and unit, as the list line states them. */
export interface LineAmount {
  amount: number | null | undefined;
  /** Units of sale to buy, explicitly chosen for this shopping list line. */
  purchaseAmount?: number | null;
  unit: string | null | undefined;
}

/** What the Store knows about the product: its Shelf Price and its Pack Size. */
export interface LineProduct {
  price: number;
  pack: PackSize | null;
}

export interface LineCost {
  /** Number of shelf-price units purchased, fractional for goods sold by weight. */
  purchaseAmount: number;
  /** Money, rounded to the cent. */
  cost: number;
  /** Whole packs counted; one for a line priced by weight or priced as one pack. */
  packs: number;
  /** Whether the amount was reconciled with the Pack Size; false is the "priced as one pack" note. */
  matched: boolean;
  /** Priced by weight: `cost` is `quantity` of the product's unit of sale. */
  byWeight: boolean;
  /** The amount priced by weight, in the family's base measure. */
  quantity?: { amount: number; unit: "gram" | "milliliter" | "piece" };
}

/** More packs than this by any route is a line nobody meant, and costs one pack with the note. */
export const MAX_PACKS = 24;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Whole packs, rounded up strictly: 410 g against "ca. 405 g" is two. The
 * epsilon is floating point hygiene and not a tolerance — 0.3 kg in grams is
 * 300.00000000000006, and that is one 300 g pack, not two.
 */
function packsFor(ratio: number): number {
  return Math.ceil(ratio - 1e-9);
}

const BASE: Record<Exclude<UnitFamily, "pack">, "gram" | "milliliter" | "piece"> = {
  mass: "gram",
  volume: "milliliter",
  count: "piece",
};

function onePack(price: number, matched: boolean): LineCost {
  return { cost: round2(price), purchaseAmount: 1, packs: 1, matched, byWeight: false };
}

function packs(price: number, count: number): LineCost {
  if (count > MAX_PACKS) return onePack(price, false);

  return {
    cost: round2(price * count),
    purchaseAmount: count,
    packs: count,
    matched: true,
    byWeight: false,
  };
}

export function lineCost(line: LineAmount, product: LineProduct): LineCost {
  const { price, pack } = product;
  const amount = line.amount ?? null;
  if (
    line.purchaseAmount != null &&
    Number.isFinite(line.purchaseAmount) &&
    line.purchaseAmount > 0
  ) {
    const count = pack?.byWeight ? line.purchaseAmount : Math.ceil(line.purchaseAmount);
    return {
      cost: round2(price * count),
      purchaseAmount: count,
      packs: count,
      matched: true,
      byWeight: false,
    };
  }
  const unit = line.unit ? resolveUnit(line.unit) : null;
  const unknownUnit = Boolean(line.unit) && unit === null;

  if (!pack) {
    // Counting products needs only a shelf price. Pack metadata is needed
    // to convert a measure, not to buy five of a product with no stated size.
    if (amount === null || amount <= 0) return onePack(price, true);
    if (!unit && !unknownUnit) return packs(price, packsFor(amount));
    if (unit?.family === "count" || unit?.family === "pack") {
      return packs(price, packsFor(amount * unit.magnitude));
    }

    return onePack(price, false);
  }
  const packUnit = resolveUnit(pack.unit);

  if (!packUnit || packUnit.family === "pack") return onePack(price, false);
  const packBase = pack.quantity * packUnit.magnitude;
  const base = BASE[packUnit.family];

  if (pack.byWeight) {
    // No amount: one unit of sale, which is what the shop's own price is for.
    if (amount === null || amount <= 0) {
      return {
        cost: round2(price),
        purchaseAmount: 1,
        packs: 1,
        matched: true,
        byWeight: true,
        quantity: { amount: packBase, unit: base },
      };
    }
    // A count against a by-weight price — two bananas of something priced
    // per kilo — is one unit of sale, and says so.
    if (!unit || unit.family !== packUnit.family || unknownUnit) {
      return {
        cost: round2(price),
        purchaseAmount: 1,
        packs: 1,
        matched: false,
        byWeight: true,
        quantity: { amount: packBase, unit: base },
      };
    }
    const quantity = amount * unit.magnitude;

    return {
      cost: round2((price * quantity) / packBase),
      purchaseAmount: quantity / packBase,
      packs: 1,
      matched: true,
      byWeight: true,
      quantity: { amount: quantity, unit: base },
    };
  }

  if (amount === null || amount <= 0) return onePack(price, true);
  if (unknownUnit) return onePack(price, false);

  // A bare number, or a count: that many packs, unless the shop counts the
  // pack in pieces too — twelve eggs of a box of ten is two boxes.
  if (!unit || unit.family === "count") {
    const pieces = amount * (unit?.magnitude ?? 1);

    if (packUnit.family === "count") return packs(price, packsFor(pieces / pack.quantity));

    return packs(price, packsFor(pieces));
  }
  // A container word: "2 pak melk" is two packs of whatever the shop sells.
  if (unit.family === "pack") return packs(price, packsFor(amount));
  // A measure against a measure of the same family, rounded up strictly.
  if (unit.family !== packUnit.family) return onePack(price, false);

  return packs(price, packsFor((amount * unit.magnitude) / packBase));
}

/**
 * What a group of lines costs as one purchase: the combined amount where
 * the lines share a unit family — 300 g and 0.4 kg price as 700 g — else
 * the lines' own packs added together.
 */
export function groupLineCost(lines: LineAmount[], product: LineProduct): LineCost {
  const first = lines[0];

  if (!first) return onePack(product.price, false);
  if (lines.length === 1) return lineCost(first, product);

  // Overrides describe purchases, so they must not be converted back into
  // ingredient measures or rounded together with automatic requirements.
  const manual = lines.filter((line) => line.purchaseAmount != null);
  if (manual.length > 0) {
    const automatic = lines.filter((line) => line.purchaseAmount == null);
    const costs = manual.map((line) => lineCost(line, product));
    if (automatic.length > 0) costs.push(groupLineCost(automatic, product));
    return {
      cost: round2(costs.reduce((sum, line) => sum + line.cost, 0)),
      purchaseAmount: costs.reduce((sum, line) => sum + line.purchaseAmount, 0),
      packs: costs.reduce((sum, line) => sum + line.packs, 0),
      matched: costs.every((line) => line.matched),
      byWeight: false,
    };
  }

  const combined = combineAmounts(lines);

  if (combined) return lineCost(combined, product);

  const costs = lines.map((line) => lineCost(line, product));
  const packs = costs.reduce((sum, line) => sum + line.packs, 0);

  // More than the cap by any route, this one included.
  if (packs > MAX_PACKS) return onePack(product.price, false);

  return {
    cost: round2(costs.reduce((sum, line) => sum + line.cost, 0)),
    purchaseAmount: costs.reduce((sum, line) => sum + line.purchaseAmount, 0),
    packs,
    matched: costs.every((line) => line.matched),
    byWeight: costs.every((line) => line.byWeight),
  };
}

/** One amount for lines that share a unit family, in that family's base measure; null where they do not. */
function combineAmounts(lines: LineAmount[]): LineAmount | null {
  let family: UnitFamily | "bare" | null = null;
  let total = 0;

  for (const line of lines) {
    if (line.amount === null || line.amount === undefined || line.amount <= 0) return null;
    const unit = line.unit ? resolveUnit(line.unit) : null;

    if (line.unit && !unit) return null;
    const own = unit?.family ?? "bare";

    if (family !== null && family !== own) return null;
    family = own;
    total += line.amount * (unit?.magnitude ?? 1);
  }

  if (family === null) return null;
  if (family === "bare") return { amount: total, unit: null };
  if (family === "pack") return { amount: total, unit: "pack" };

  return { amount: total, unit: BASE[family] };
}
