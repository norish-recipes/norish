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
 * Region codes CLDR knows but that are not somewhere a recipe comes from:
 * placeholders and supranational groupings.
 */
const NOT_A_COUNTRY = new Set(["ZZ", "QO", "EU", "EZ", "UN"]);

export interface CountryOption {
  /** ISO-3166-1 alpha-2 code, which is what gets stored. */
  code: string;
  /** The country's name in the requested language. */
  name: string;
}

/**
 * Every country an editor can pick, named in their language and sorted for it.
 *
 * Derived from the platform's own region display names rather than a bundled
 * list, so it stays in step with the runtime and needs no data file to age.
 */
export function listCountryOptions(locale: string): CountryOption[] {
  const options: CountryOption[] = [];

  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);

      if (NOT_A_COUNTRY.has(code)) continue;

      const name = countryDisplayName(code, locale);

      // `countryDisplayName` falls back to the code, which is how an unassigned
      // code announces itself here.
      if (name === null || name === code) continue;

      options.push({ code, name });
    }
  }

  try {
    const collator = new Intl.Collator(locale);

    options.sort((a, b) => collator.compare(a.name, b.name));
  } catch {
    options.sort((a, b) => a.name.localeCompare(b.name));
  }

  return options;
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
