import { describe, expect, it } from "vitest";

import { normalizeLocaleConfig } from "@norish/shared-react/hooks";

describe("normalizeLocaleConfig", () => {
  it("falls back to default locale when response is invalid", () => {
    expect(
      normalizeLocaleConfig({
        defaultLocale: "???",
        enabledLocales: [],
      })
    ).toEqual({
      defaultLocale: "en",
      enabledLocales: [],
    });
  });

  it("filters out invalid enabled locale entries", () => {
    expect(
      normalizeLocaleConfig({
        defaultLocale: "en",
        enabledLocales: [
          { code: "en", name: "English" },
          { code: "invalid@@", name: "Invalid" },
        ],
      })
    ).toEqual({
      defaultLocale: "en",
      enabledLocales: [{ code: "en", name: "English" }],
    });
  });
});
