import "@/lib/i18n/list-format";

import { describe, expect, it } from "vitest";

import { getBundledLocales } from "@norish/i18n/locales";

describe("list format polyfill", () => {
  it("has list data for every bundled locale's language", () => {
    const languages = [...new Set(getBundledLocales().map(({ code }) => code.split("-")[0]))];

    // Node has its own ListFormat; the polyfill's only knows the languages loaded for it.
    expect(Intl.ListFormat).toHaveProperty("polyfilled", true);
    expect(Intl.ListFormat.supportedLocalesOf(languages)).toEqual(languages);
  });

  it("joins the way the language does", () => {
    const names = ["A", "B", "C"];

    expect(new Intl.ListFormat("en", { type: "conjunction" }).format(names)).toBe("A, B, and C");
    expect(new Intl.ListFormat("nl", { type: "conjunction" }).format(names)).toBe("A, B en C");
  });
});
