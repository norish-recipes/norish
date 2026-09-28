import { describe, expect, it } from "vitest";

import { nameWords, foldName } from "@norish/shared/lib/fold-name";

describe("foldName", () => {
  it("folds case", () => {
    expect(foldName("Oude Kaas")).toBe("oude kaas");
  });

  it("folds diacritics", () => {
    expect(foldName("Crème fraîche")).toBe("creme fraiche");
    expect(foldName("Käse")).toBe("kase");
  });

  it("folds punctuation and collapses whitespace", () => {
    expect(foldName("  oude   kaas!  ")).toBe("oude kaas");
    expect(foldName("half-volle melk (1L)")).toBe("half volle melk 1l");
  });

  it("keeps letters of every script", () => {
    expect(foldName("Сыр")).toBe("сыр");
    expect(foldName("치즈")).toBe("치즈");
  });

  it("folds nothing out of nothing", () => {
    expect(foldName(null)).toBe("");
    expect(foldName("   ")).toBe("");
  });
});

describe("nameWords", () => {
  it("counts the words the auto-link rule looks for", () => {
    expect(nameWords("Oude  Kaas!")).toEqual(["oude", "kaas"]);
    expect(nameWords("")).toEqual([]);
  });
});
