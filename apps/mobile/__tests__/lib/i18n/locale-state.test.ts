import {
  buildLocaleDisplayMap,
  deviceLanguage,
  matchDeviceLocale,
  normalizeEnabledLocales,
  resolveLocaleSelection,
} from "@/lib/i18n/locale-state";
import { describe, expect, it } from "vitest";

import { getBundledLocales } from "@norish/i18n/locales";

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

describe("matchDeviceLocale", () => {
  const bundled = getBundledLocales();
  const signedOutLocale = (device: string) =>
    resolveLocaleSelection(matchDeviceLocale(device, bundled), bundled, "en");

  it("takes an exact match", () => {
    expect(signedOutLocale("nl")).toBe("nl");
    expect(signedOutLocale("pt-BR")).toBe("pt-BR");
  });

  it("falls back from a region to its language", () => {
    expect(signedOutLocale("nl-BE")).toBe("nl");
    expect(signedOutLocale("pt-PT")).toBe("pt-BR");
    expect(signedOutLocale("nb-NO")).toBe("no");
  });

  it("gives German the informal variant", () => {
    for (const device of ["de", "de-DE", "de-CH", "de-AT"]) {
      expect(signedOutLocale(device)).toBe("de-informal");
    }
  });

  it("falls back to English when no locale matches", () => {
    expect(signedOutLocale("ja-JP")).toBe("en");
  });
});

describe("deviceLanguage", () => {
  it("takes the app's first iOS language, which the per-app language setting changes", () => {
    expect(deviceLanguage(["nl-NL", "en-US"], "en-US")).toBe("nl-NL");
  });

  it("falls back when iOS reports no languages", () => {
    expect(deviceLanguage(undefined, "en-US")).toBe("en-US");
    expect(deviceLanguage([], "en-US")).toBe("en-US");
  });
});
