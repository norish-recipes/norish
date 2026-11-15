import "@/lib/i18n/display-names";

import { describe, expect, it } from "vitest";

import { getBundledLocales } from "@norish/i18n/locales";
import { listCountryOptions } from "@norish/shared/lib/recipe-provenance";

describe("display names polyfill", () => {
  it("has region names for every bundled locale's language", () => {
    const languages = [...new Set(getBundledLocales().map(({ code }) => code.split("-")[0]))];

    // Node has its own DisplayNames; the polyfill's only knows the languages loaded for it.
    expect(Intl.DisplayNames).toHaveProperty("polyfilled", true);
    expect(Intl.DisplayNames.supportedLocalesOf(languages)).toEqual(languages);
  });

  it("names the countries the editor offers", () => {
    const countries = listCountryOptions("nl");

    expect(countries.length).toBeGreaterThan(200);
    expect(countries.find((option) => option.code === "DE")?.name).toBe("Duitsland");
  });
});
