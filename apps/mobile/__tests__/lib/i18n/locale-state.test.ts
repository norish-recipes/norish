import { describe, expect, it } from "vitest";

import {
  buildLocaleDisplayMap,
  normalizeEnabledLocales,
  resolveLocaleSelection,
} from "../../../src/lib/i18n/locale-state";

describe("normalizeEnabledLocales", () => {
  it("filters invalid locale codes", () => {
    const locales = normalizeEnabledLocales(
      [
        { code: "en", name: "English" },
        { code: "invalid@@", name: "Invalid" },
      ],
      "en"
    );

    expect(locales).toEqual([{ code: "en", name: "English" }]);
  });

  it("falls back to default locale when no locales are enabled", () => {
    const locales = normalizeEnabledLocales([], "fr");

    expect(locales).toHaveLength(1);
    expect(locales[0]?.code).toBe("fr");
    // name is resolved via Intl.DisplayNames — just verify it's a non-empty string
    expect(typeof locales[0]?.name).toBe("string");
    expect(locales[0]?.name.length).toBeGreaterThan(0);
  });
});

describe("resolveLocaleSelection", () => {
  const enabledLocales = [
    { code: "en", name: "English" },
    { code: "fr", name: "Francais" },
  ];

  it("keeps selected locale when still enabled", () => {
    expect(resolveLocaleSelection("fr", enabledLocales, "en")).toBe("fr");
  });

  it("falls back to configured default locale when selection is disabled", () => {
    expect(resolveLocaleSelection("es", enabledLocales, "en")).toBe("en");
  });
});

describe("buildLocaleDisplayMap", () => {
  it("creates selector label map from enabled locales", () => {
    expect(
      buildLocaleDisplayMap([
        { code: "en", name: "English" },
        { code: "nl", name: "Nederlands" },
      ])
    ).toEqual({
      en: "English",
      nl: "Nederlands",
    });
  });
});
