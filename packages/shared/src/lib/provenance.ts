/**
 * Recipe Provenance — framework-agnostic helpers shared by the AI inference
 * boundary (server) and the web presentation layer (client).
 *
 * Provenance is one nullable ISO 3166-1 alpha-2 origin country code, an optional
 * region, a normalized list of cuisine labels, and a short explanatory note.
 * Country codes are validated against ISO 3166-1 alpha-2 in code (via the
 * platform `Intl` APIs) rather than a duplicated, editable country list, and
 * flags are derived from the validated code — never stored.
 */

/**
 * Authoritative lifecycle state of provenance inference for a recipe.
 * `idle` — no provenance and nothing queued; `queued`/`processing` — inference
 * in flight; `succeeded` — provenance persisted; `failed` — inference reached a
 * terminal failure.
 */
export type ProvenanceStatus = "idle" | "queued" | "processing" | "succeeded" | "failed";

/** Statuses at which inference is still running and the panel shows pending. */
export function isProvenancePending(status: ProvenanceStatus): boolean {
  return status === "queued" || status === "processing";
}

/** The normalized provenance shape produced by inference and persisted. */
export interface RecipeProvenance {
  originCountryCode: string | null;
  region: string | null;
  cuisines: string[];
  note: string | null;
}

/** A recipe carrying provenance inference results may leave any field empty. */
export interface RawRecipeProvenance {
  originCountryCode?: string | null;
  region?: string | null;
  cuisines?: readonly unknown[] | null;
  note?: string | null;
}

export const MAX_CUISINE_LABELS = 6;
export const MAX_CUISINE_LABEL_LENGTH = 40;
export const MAX_REGION_LENGTH = 120;
export const MAX_PROVENANCE_NOTE_LENGTH = 600;

const ALPHA2_PATTERN = /^[A-Za-z]{2}$/;

/**
 * True when `code` is a real ISO 3166-1 alpha-2 country code. Validated in code
 * against the platform region data: two letters whose `Intl.DisplayNames`
 * region name resolves to something other than the code itself (the default
 * "code" fallback for unassigned codes).
 */
export function isValidCountryCode(code: string | null | undefined): code is string {
  if (typeof code !== "string" || !ALPHA2_PATTERN.test(code)) {
    return false;
  }

  const upper = code.toUpperCase();

  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(upper);

    return typeof name === "string" && name !== upper;
  } catch {
    return false;
  }
}

/** Uppercase and validate a country code, returning `null` when not a real code. */
export function normalizeCountryCode(code: string | null | undefined): string | null {
  return isValidCountryCode(code) ? code.toUpperCase() : null;
}

/**
 * Derive the regional-indicator flag emoji for a valid country code, or `null`
 * when the code is not a real ISO 3166-1 alpha-2 code (so an uncertain origin
 * shows no flag rather than a guess).
 */
export function countryCodeToFlagEmoji(code: string | null | undefined): string | null {
  if (!isValidCountryCode(code)) {
    return null;
  }

  const base = 0x1f1e6 - "A".charCodeAt(0);

  return String.fromCodePoint(...[...code.toUpperCase()].map((char) => char.charCodeAt(0) + base));
}

/** Localize a valid country code for `locale`, or `null` when invalid. */
export function getLocalizedCountryName(
  code: string | null | undefined,
  locale: string
): string | null {
  if (!isValidCountryCode(code)) {
    return null;
  }

  try {
    const name = new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase());

    return typeof name === "string" ? name : null;
  } catch {
    return null;
  }
}

/** Trim, bound, drop empties, and case-insensitively dedupe cuisine labels. */
export function normalizeCuisines(values: readonly unknown[] | null | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    if (typeof raw !== "string") {
      continue;
    }

    const trimmed = raw.trim().slice(0, MAX_CUISINE_LABEL_LENGTH).trim();

    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);

    if (result.length >= MAX_CUISINE_LABELS) {
      break;
    }
  }

  return result;
}

function normalizeBoundedText(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().slice(0, maxLength).trim();

  return trimmed || null;
}

/** Normalize a region or sub-region string. */
export function normalizeRegion(region: string | null | undefined): string | null {
  return normalizeBoundedText(region, MAX_REGION_LENGTH);
}

/** Normalize the explanatory note. */
export function normalizeProvenanceNote(note: string | null | undefined): string | null {
  return normalizeBoundedText(note, MAX_PROVENANCE_NOTE_LENGTH);
}

/**
 * Structurally normalize a raw inference result: validate the country against
 * ISO 3166-1 alpha-2 (invalid → null), trim and bound region/note, and
 * deduplicate cuisines. An invalid country never discards the rest of the
 * result — it just omits the flag-bearing origin.
 */
export function normalizeRecipeProvenance(raw: RawRecipeProvenance): RecipeProvenance {
  return {
    originCountryCode: normalizeCountryCode(raw.originCountryCode),
    region: normalizeRegion(raw.region),
    cuisines: normalizeCuisines(raw.cuisines),
    note: normalizeProvenanceNote(raw.note),
  };
}

/**
 * True when a recipe already carries any provenance value. Accepts the persisted
 * recipe shape (`provenanceNote`) so both the status query and the panel share
 * one definition; fields are optional to tolerate a partial recipe DTO.
 */
export function recipeHasProvenance(recipe: {
  originCountryCode?: string | null;
  region?: string | null;
  cuisines?: readonly string[] | null;
  provenanceNote?: string | null;
}): boolean {
  return Boolean(
    recipe.originCountryCode ||
      recipe.region ||
      (recipe.cuisines?.length ?? 0) > 0 ||
      recipe.provenanceNote
  );
}
