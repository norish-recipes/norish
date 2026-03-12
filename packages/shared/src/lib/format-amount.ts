import Fraction from "fraction.js";

export type AmountDisplayMode = "decimal" | "fraction";

/**
 * Unicode fraction symbols for common cooking fractions.
 * These render nicer than "1/2" style fractions.
 */
const UNICODE_FRACTIONS: Record<string, string> = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/5": "⅕",
  "2/5": "⅖",
  "3/5": "⅗",
  "4/5": "⅘",
  "1/6": "⅙",
  "5/6": "⅚",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
};

/**
 * Format a fraction string (e.g., "1/2") using Unicode symbols when available.
 */
function toUnicodeFraction(fractionStr: string): string {
  return UNICODE_FRACTIONS[fractionStr] ?? fractionStr;
}

/**
 * Format a number as a clean decimal string.
 * Removes unnecessary trailing zeros (e.g., 2.50 -> 2.5, 2.00 -> 2)
 */
export function formatAmountAsDecimal(n: number | null | string): string {
  if (n == null || n === "") return "";

  const num = typeof n === "string" ? parseFloat(n) : n;

  if (isNaN(num)) return String(n);
  if (Number.isInteger(num)) return String(num);

  // Remove trailing zeros (e.g., 2.50 -> 2.5)
  return num.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Format a number as a fraction string using Unicode symbols.
 * Examples:
 *   0.5 -> "½"
 *   1.5 -> "1 ½"
 *   0.333 -> "⅓"
 *   2.75 -> "2 ¾"
 *
 * Falls back to decimal for numbers that don't convert to nice fractions.
 */
export function formatAmountAsFraction(n: number | null | string): string {
  if (n == null || n === "") return "";

  const num = typeof n === "string" ? parseFloat(n) : n;

  if (isNaN(num)) return String(n);
  if (Number.isInteger(num)) return String(num);

  try {
    // Use fraction.js with simplification to handle floating point imprecision
    // Tolerance of 0.01 allows 0.333 to become 1/3, 0.666 to become 2/3, etc.
    const frac = new Fraction(num).simplify(0.01);

    const wholePart = Math.floor(Math.abs(num));
    const isNegative = num < 0;

    // Get the fractional part
    const fracPart = frac.mod(1).abs();

    if (fracPart.valueOf() === 0) {
      // It's a whole number after simplification
      return String(Math.round(num));
    }

    const fractionStr = fracPart.toFraction();
    const unicodeFrac = toUnicodeFraction(fractionStr);

    // Check if we got a reasonable fraction (denominator <= 16)
    // If not, fall back to decimal
    const denominator = fracPart.d;

    if (denominator > 16) {
      return formatAmountAsDecimal(num);
    }

    const sign = isNegative ? "-" : "";

    if (wholePart === 0) {
      return `${sign}${unicodeFrac}`;
    }

    return `${sign}${wholePart} ${unicodeFrac}`;
  } catch {
    // If fraction.js fails, fall back to decimal
    return formatAmountAsDecimal(num);
  }
}

/**
 * Format an amount based on the display mode preference.
 */
export function formatAmount(
  n: number | null | string,
  mode: AmountDisplayMode = "decimal"
): string {
  if (mode === "fraction") {
    return formatAmountAsFraction(n);
  }

  return formatAmountAsDecimal(n);
}
