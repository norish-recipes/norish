import { describe, expect, it } from "vitest";

import { countryDisplayName, countryFlagEmoji } from "@norish/shared/lib/recipe-provenance";

describe("countryFlagEmoji", () => {
  it("maps an alpha-2 code onto its flag", () => {
    expect(countryFlagEmoji("IT")).toBe("🇮🇹");
    expect(countryFlagEmoji("jp")).toBe("🇯🇵");
  });

  it("renders nothing for anything that is not a code", () => {
    // A display name would otherwise become two stray letters beside the region.
    expect(countryFlagEmoji("Italy")).toBeNull();
    expect(countryFlagEmoji("")).toBeNull();
    expect(countryFlagEmoji(null)).toBeNull();
  });
});

describe("countryDisplayName", () => {
  it("names the country in the reader's own language", () => {
    expect(countryDisplayName("IT", "en")).toBe("Italy");
    expect(countryDisplayName("IT", "nl")).toBe("Italië");
    expect(countryDisplayName("JP", "fr")).toBe("Japon");
  });

  it("falls back to the code when the platform has no name for it", () => {
    // QQ is unassigned; ZZ deliberately is not, because CLDR names it.
    expect(countryDisplayName("QQ", "en")).toBe("QQ");
  });

  it("falls back to the code rather than throwing on an unusable locale", () => {
    expect(countryDisplayName("IT", "en_US")).toBe("IT");
  });

  it("renders nothing for anything that is not a code", () => {
    expect(countryDisplayName("Italy", "en")).toBeNull();
    expect(countryDisplayName(null, "en")).toBeNull();
  });
});
