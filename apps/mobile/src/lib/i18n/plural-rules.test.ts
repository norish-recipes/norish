import "./plural-rules";

import { describe, expect, it } from "vitest";

import { getBundledLocales } from "@norish/i18n/locales";

describe("plural rules polyfill", () => {
  it("has plural data for every bundled locale's language", () => {
    const languages = [...new Set(getBundledLocales().map(({ code }) => code.split("-")[0]))];

    // Node has its own PluralRules; the polyfill's only knows the languages loaded for it.
    expect(Intl.PluralRules).toHaveProperty("polyfilled", true);
    expect(Intl.PluralRules.supportedLocalesOf(languages)).toEqual(languages);
  });

  it("picks the plural category the polyfill was loaded for", () => {
    expect(new Intl.PluralRules("ru").select(3)).toBe("few");
  });
});
