import type { FlatUnitsMap, UnitsMap } from "@norish/config/zod/server-config";

import { selectUnitForm } from "./unit-form-selector";

/**
 * Flatten locale-aware units config to flat format for parse-ingredient library.
 * Uses the first locale's short and plural forms so the parser can recognize both.
 */
export function flattenForLibrary(config: UnitsMap): FlatUnitsMap {
  const flattened: FlatUnitsMap = {};

  for (const [unitId, unitDef] of Object.entries(config)) {
    // Collect all locale-specific short and plural names
    const shortNames: string[] = Array.isArray(unitDef.short)
      ? unitDef.short.map((s) => s?.name).filter(Boolean as any)
      : [];

    const pluralNames: string[] = Array.isArray(unitDef.plural)
      ? unitDef.plural.map((p) => p?.name).filter(Boolean as any)
      : [];

    // Merge existing alternates with locale-specific forms and remove duplicates
    const mergedAlternates = Array.from(
      new Set([...(unitDef.alternates || []), ...shortNames, ...pluralNames])
    );

    flattened[unitId] = {
      short: shortNames[0] || unitId, // prefer first short form
      plural: pluralNames[0] || unitId, // prefer first plural form
      alternates: mergedAlternates,
    };
  }

  return flattened;
}

/**
 * Normalize a unit string to its canonical unit ID.
 * Used when SAVING ingredients to database.
 *
 * This searches through the units config to find which canonical ID
 * this abbreviation/alternate belongs to.
 *
 * Examples:
 *   "gr" => "gram" (found in gram.alternates)
 *   "grammen" => "gram" (found in gram.alternates)
 *   "scheutje" => "dash" (found in dash.alternates)
 *   "EL" => "tablespoon" (found in tablespoon.short or alternates)
 */
export function normalizeUnit(unit: string, config: UnitsMap): string {
  if (!unit || unit.trim() === "") return "";
  const lowerUnit = unit.toLowerCase();

  // Check each unit definition to see if this abbreviation matches
  for (const [unitId, unitDef] of Object.entries(config)) {
    // Skip if unitDef is not properly defined
    if (!unitDef) continue;

    // Check if it's already the canonical ID
    if (unitId.toLowerCase() === lowerUnit) {
      return unitId;
    }

    // Check short forms (with null safety)
    if (unitDef.short && Array.isArray(unitDef.short)) {
      if (unitDef.short.some((form) => form?.name?.toLowerCase() === lowerUnit)) {
        return unitId;
      }
    }

    // Check plural forms (with null safety)
    if (unitDef.plural && Array.isArray(unitDef.plural)) {
      if (unitDef.plural.some((form) => form?.name?.toLowerCase() === lowerUnit)) {
        return unitId;
      }
    }

    // Check alternates (with null safety)
    if (unitDef.alternates && Array.isArray(unitDef.alternates)) {
      if (unitDef.alternates.some((alt) => alt?.toLowerCase() === lowerUnit)) {
        return unitId;
      }
    }
  }

  // Not found in config - return as-is
  return unit;
}

/**
 * Format a unit for display based on user's locale.
 * Uses short form by default, and plural form when quantity > 1.
 *
 * @param unitId - The canonical unit ID (e.g., "gram", "tablespoon", "dash")
 * @param userLocale - User's locale (e.g., "en", "de-formal", "nl")
 * @param config - The locale-aware units configuration
 * @param quantity - Optional quantity used to decide singular/plural form
 * @returns The localized unit name
 *
 * @example
 * formatUnit("gram", "en", config) => "g"
 * formatUnit("gram", "de", config) => "g"
 * formatUnit("gram", "en", config, 2) => "grams"
 */
function getLocalizedUnitName(
  forms: Array<{ locale: string; name: string }>,
  userLocale: string
): string | null {
  // Try exact match first (e.g., "de-formal")
  const exactMatch = forms.find((f) => f.locale === userLocale);

  if (exactMatch) return exactMatch.name;

  // Try base locale match (e.g., "de" for "de-formal" or "de-informal")
  const baseLocale = userLocale.split("-")[0];

  if (baseLocale !== userLocale) {
    const baseMatch = forms.find(
      (f) => f.locale === baseLocale || f.locale.startsWith(baseLocale + "-")
    );

    if (baseMatch) return baseMatch.name;
  }

  // Fallback to English
  const en = forms.find((f) => f.locale === "en");

  if (en) return en.name;

  // Last resort: first available
  return forms[0]?.name ?? null;
}

export function formatUnit(
  unitId: string,
  userLocale: string,
  config: UnitsMap,
  quantity?: number | null
): string {
  const unitDef = config[unitId];

  if (!unitDef) return unitId; // Unknown unit, return as-is

  const singular = getLocalizedUnitName(unitDef.short, userLocale);
  const plural = getLocalizedUnitName(unitDef.plural, userLocale);

  return (
    selectUnitForm(quantity, {
      singular,
      plural,
    }) ?? unitId
  );
}
