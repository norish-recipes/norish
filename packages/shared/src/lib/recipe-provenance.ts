/**
 * Rendering helpers for Recipe Provenance.
 *
 * The origin country is stored as an ISO-3166-1 alpha-2 code precisely so that
 * the reader's own language decides how it reads. Both helpers are pure and take
 * the code, never a display name.
 */

import { normalizeOriginCountry } from "./recipe-enrichment";

/** Offset from ASCII 'A' to the Unicode regional indicator symbols. */
const REGIONAL_INDICATOR_A = 0x1f1e6;
const ASCII_A = "A".charCodeAt(0);

/**
 * The flag emoji for an alpha-2 country code.
 *
 * Returns null for anything that is not a code, so a malformed value renders as
 * nothing rather than as two stray letters.
 */
export function countryFlagEmoji(code: string | null | undefined): string | null {
  const normalized = normalizeOriginCountry(code);

  if (normalized === null) return null;

  return String.fromCodePoint(
    ...[...normalized].map((letter) => letter.charCodeAt(0) - ASCII_A + REGIONAL_INDICATOR_A)
  );
}

/**
 * The country's name in the reader's language.
 *
 * Falls back to the code itself when the platform has no display name for it,
 * which is better than an empty label beside a flag.
 */
export function countryDisplayName(code: string | null | undefined, locale: string): string | null {
  const normalized = normalizeOriginCountry(code);

  if (normalized === null) return null;

  try {
    // `fallback: "none"` returns undefined for a code the platform does not
    // know, which is more useful than its "Unknown Region" placeholder.
    const display = new Intl.DisplayNames([locale], { type: "region", fallback: "none" });

    return display.of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}
