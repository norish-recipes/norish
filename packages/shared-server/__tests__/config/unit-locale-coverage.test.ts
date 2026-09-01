// @vitest-environment node
/**
 * Every bundled language can name every unit.
 *
 * `formatUnit` falls back to English when a unit has no form for the reader's
 * locale, so a gap in the vocabulary is invisible in code and shows up as
 * "500 grams" on a Spanish shopping list (#504). The vocabulary and the locale
 * catalog are separate files that nothing else forces to agree, which is how
 * six of the fourteen shipped languages came to have no unit names at all.
 *
 * This is the only place the two are compared, so it fails when a language is
 * added to the catalog without units, and when a unit is added without them.
 */
import { describe, expect, it } from "vitest";

import type { UnitsMap } from "@norish/config/zod/server-config";
import defaultUnits from "@norish/config/units.default.json";
import { LOCALE_CATALOG } from "@norish/i18n/locales";

const units = defaultUnits as UnitsMap;

/**
 * The locale a unit name is looked up under. `getLocalizedUnitName` matches the
 * catalog code first and its base language second, so "de-formal" and
 * "de-informal" are both served by "de", and "pt-BR" by "pt".
 */
const BASE_LANGUAGES = [...new Set(Object.keys(LOCALE_CATALOG).map((code) => code.split("-")[0]))];

function namesFor(field: "short" | "plural", locale: string): Map<string, string | undefined> {
  return new Map(
    Object.entries(units).map(([unitId, unit]) => [
      unitId,
      unit[field].find((form) => form.locale === locale)?.name?.trim() || undefined,
    ])
  );
}

describe("the shipped unit vocabulary", () => {
  it.each(BASE_LANGUAGES)("names every unit in %s", (locale) => {
    const missing = [
      ...[...namesFor("short", locale)].filter(([, name]) => !name).map(([id]) => `${id}.short`),
      ...[...namesFor("plural", locale)].filter(([, name]) => !name).map(([id]) => `${id}.plural`),
    ];

    expect(missing).toEqual([]);
  });

  it("covers every language the app can be read in", () => {
    // Guards the direction the it.each above cannot: a language whose only
    // unit names are English ones would pass a per-unit check on "en".
    expect(BASE_LANGUAGES.length).toBeGreaterThan(1);

    const covered = new Set(
      Object.values(units).flatMap((unit) => unit.short.map((form) => form.locale))
    );

    expect(BASE_LANGUAGES.filter((locale) => !covered.has(locale))).toEqual([]);
  });
});
