import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { buildCatalogue, localization } = require("../../plugins/with-share-strings.js") as {
  buildCatalogue: () => { strings: Record<string, { localizations: Record<string, unknown> }> };
  localization: (message: string, where: string) => unknown;
};

describe("with-share-strings", () => {
  it("writes a plain message as it is", () => {
    expect(localization("Saved for later", "en.saved")).toEqual({
      stringUnit: { state: "translated", value: "Saved for later" },
    });
  });

  it("writes a whole-message plural as plural variations on %lld", () => {
    expect(
      localization("{count, plural, one {# photo} other {# photos}}", "en.photoCount")
    ).toEqual({
      variations: {
        plural: {
          one: { stringUnit: { state: "translated", value: "%lld photo" } },
          other: { stringUnit: { state: "translated", value: "%lld photos" } },
        },
      },
    });
  });

  it("refuses a placeholder, a plural inside text and a plural without other", () => {
    expect(() => localization("Sent to {server}", "en.sent")).toThrow("en.sent");
    expect(() => localization("Got {count, plural, other {#}} photos", "en.got")).toThrow();
    expect(() => localization("{count, plural, one {# photo}}", "en.one")).toThrow("other");
  });

  it("names each catalogue locale as iOS does, leaving out de-formal", () => {
    const locales = new Set(
      Object.values(buildCatalogue().strings).flatMap((entry) => Object.keys(entry.localizations))
    );

    expect(locales).toContain("de");
    expect(locales).toContain("nb");
    expect(locales).toContain("en");
    for (const code of ["de-informal", "de-formal", "no"]) expect(locales).not.toContain(code);
  });
});
