import { describe, expect, it } from "vitest";

import { LOCALE_CATALOG } from "@norish/i18n/locales";

import appConfig from "../../../app.json";

// iOS names Norwegian `nb` and has no formal/informal German, so both map to `de`.
const IOS_LANGUAGE: Record<string, string> = { no: "nb", "de-formal": "de", "de-informal": "de" };

describe("CFBundleLocalizations", () => {
  it("declares every catalogue locale under its iOS language code", () => {
    const expected = [
      ...new Set(Object.keys(LOCALE_CATALOG).map((code) => IOS_LANGUAGE[code] ?? code)),
    ];

    expect(appConfig.expo.ios.infoPlist.CFBundleLocalizations).toEqual(expected);
  });
});
