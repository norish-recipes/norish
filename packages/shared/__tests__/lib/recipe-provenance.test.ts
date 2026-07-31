import { describe, expect, it } from "vitest";

import {
  countryDisplayName,
  countryEndonym,
  countryFlagEmoji,
  listCountryOptions,
} from "@norish/shared/lib/recipe-provenance";

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

describe("listCountryOptions", () => {
  it("offers countries named and sorted in the editor's language", () => {
    const dutch = listCountryOptions("nl");

    expect(dutch).toContainEqual({ code: "IT", name: "Italië" });
    expect(dutch.map((option) => option.name)).toEqual(
      [...dutch.map((option) => option.name)].sort(new Intl.Collator("nl").compare)
    );
  });

  it("omits placeholders and supranational groupings", () => {
    const codes = listCountryOptions("en").map((option) => option.code);

    // Not somewhere a recipe comes from.
    for (const code of ["ZZ", "EU", "UN", "QO"]) {
      expect(codes).not.toContain(code);
    }

    expect(codes).toContain("JP");
  });
});

describe("countryEndonym", () => {
  it("names the country in its own language, whatever the reader speaks", () => {
    expect(countryEndonym("NL", "en")).toBe("Nederland");
    expect(countryEndonym("IT", "nl")).toBe("Italia");
    expect(countryEndonym("DE", "en")).toBe("Deutschland");
    expect(countryEndonym("jp", "en")).toBe("日本");
  });

  it("falls back to the code for a region with no name of its own", () => {
    // QQ is unassigned: likely-subtags offer no language that names it.
    expect(countryEndonym("QQ", "en")).toBe("QQ");
  });

  it("renders nothing for anything that is not a code", () => {
    expect(countryEndonym("Italy", "en")).toBeNull();
    expect(countryEndonym(null, "en")).toBeNull();
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
