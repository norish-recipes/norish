/**
 * Every locale Norish ships reads Ingredient names in a language the server
 * sends, so no viewer silently falls back to the English name.
 */
import { describe, expect, it } from "vitest";

import { BUNDLED_LOCALES } from "@norish/i18n/locales";
import { CATALOGUE_LANGUAGES, catalogueLanguagesFor } from "@norish/shared/lib/ingredient-names";

describe("catalogue languages", () => {
  it.each(BUNDLED_LOCALES.map((locale) => locale.code))("covers the %s locale", (code) => {
    expect(
      catalogueLanguagesFor(code).some((language) => CATALOGUE_LANGUAGES.includes(language))
    ).toBe(true);
  });
});
