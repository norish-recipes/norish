import type { PackSize } from "@norish/shared/lib/pack-size";
import { formatAmountAsDecimal } from "@norish/shared/lib/format-amount";
import { unitLabel } from "@norish/shared/lib/units";

/**
 * A Shelf Price as a shopper reads it: the shop's own currency, the reader's
 * own locale. Never a price per kilo — that is a different number Norish does
 * not show.
 */
export function formatShelfPrice(locale: string, price: number, currency: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(price);
  } catch {
    // An unknown currency code is the shop's business, not a reason to show
    // the reader nothing.
    return `${currency} ${price.toFixed(2)}`;
  }
}

/** The translated words a Pack Size needs that the unit table does not carry. */
export interface PackSizeWords {
  /** "per {unit}": the unit of sale of what is sold loose. */
  per: (unit: string) => string;
  /** "piece" or "pieces", for the count given. */
  pieces: (count: number) => string;
}

/**
 * Norish's own words for a Pack Size, for a product whose shop supplied no
 * size words or whose Pack Size was set by hand: "500 g", "6 pieces",
 * "per kg", "per 100 g". Where the shop's words exist they are shown instead.
 */
export function formatPackSize(pack: PackSize, words: PackSizeWords): string {
  const unit = pack.unit === "piece" ? words.pieces(pack.quantity) : unitLabel(pack.unit);
  const quantity = formatAmountAsDecimal(pack.quantity);

  if (pack.byWeight) return words.per(pack.quantity === 1 ? unit : `${quantity} ${unit}`);

  return `${quantity} ${unit}`;
}
