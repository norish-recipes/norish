import { describe, expect, it } from "vitest";

import {
  builtInsFirst,
  chosenEntries,
  createOffer,
  entryPickerView,
  hasName,
  matchEntries,
} from "../entry-matching";

const list = (...names: string[]) => names.map((name, index) => ({ id: `e${index}`, name }));

describe("matchEntries", () => {
  it("matches on the folded name, whatever the case or accents", () => {
    const entries = list("BBQ", "Café", "Soup");

    expect(matchEntries("tag", entries, "bbq").map((e) => e.name)).toEqual(["BBQ"]);
    expect(matchEntries("tag", entries, "CAFE").map((e) => e.name)).toEqual(["Café"]);
  });

  it("puts the entries starting with the text before those containing it", () => {
    const entries = list("Fast food", "Food", "Foodie");

    expect(matchEntries("tag", entries, "food").map((e) => e.name)).toEqual([
      "Food",
      "Foodie",
      "Fast food",
    ]);
  });

  it("matches every entry for empty text, and a Category through its built-in alias", () => {
    const entries = list("Breakfast", "Dinner");

    expect(matchEntries("tag", entries, "  ")).toHaveLength(2);
    expect(matchEntries("category", entries, "ontbijt", { ontbijt: "Breakfast" })).toEqual([
      entries[0],
    ]);
  });
});

describe("createOffer", () => {
  const entries = list("BBQ", "Café");

  it("offers the typed name when no entry folds like it", () => {
    expect(createOffer("tag", entries, "  Grill ")).toEqual({ kind: "create", name: "Grill" });
  });

  it("offers nothing when an entry folds alike, or for empty text", () => {
    expect(createOffer("tag", entries, "bbq")).toEqual({ kind: "none" });
    expect(createOffer("tag", entries, "cafe")).toEqual({ kind: "none" });
    expect(createOffer("tag", entries, "")).toEqual({ kind: "none" });
    expect(createOffer("tag", entries, "   ")).toEqual({ kind: "none" });
  });

  it("offers nothing for a Category that is an alias of a built-in the list has", () => {
    expect(createOffer("category", list("Breakfast"), "ontbijt", { ontbijt: "Breakfast" })).toEqual(
      { kind: "none" }
    );
  });

  it("refuses a name over its kind's bound, with the bound", () => {
    expect(createOffer("category", [], "x".repeat(41))).toEqual({ kind: "tooLong", max: 40 });
    expect(createOffer("category", [], "x".repeat(40))).toMatchObject({ kind: "create" });
    expect(createOffer("cuisine", [], "x".repeat(81))).toEqual({ kind: "tooLong", max: 80 });
    expect(createOffer("tag", [], "x".repeat(500))).toMatchObject({ kind: "create" });
  });
});

describe("chosenEntries", () => {
  it("names a chosen id from the list, else from what the recipe carries, else drops it", () => {
    const entries = [{ id: "a", name: "Thai" }];
    const carried = [{ id: "b", name: "Carried" }];

    expect(chosenEntries(["b", "a", "zzz"], entries, carried)).toEqual([
      { id: "b", name: "Carried" },
      { id: "a", name: "Thai" },
    ]);
  });
});

describe("hasName", () => {
  it("is one rule for every kind: the fold, not the exact name", () => {
    expect(hasName(["Café", "BBQ"], "cafe")).toBe(true);
    expect(hasName(["Café"], "Cafe au lait")).toBe(false);
  });
});

describe("builtInsFirst", () => {
  it("puts the built-ins first in their order and keeps the rest as they were", () => {
    const entries = list("Zesty", "Dinner", "Apples", "Breakfast");

    expect(builtInsFirst(entries).map((e) => e.name)).toEqual([
      "Breakfast",
      "Dinner",
      "Zesty",
      "Apples",
    ]);
  });
});

describe("entryPickerView", () => {
  const view = (over: Partial<Parameters<typeof entryPickerView>[0]> = {}) =>
    entryPickerView({
      kind: "tag",
      entries: list("BBQ", "Café"),
      loaded: true,
      listFailed: false,
      typed: "",
      isSelected: () => false,
      failedName: null,
      offline: false,
      ...over,
    });

  it("offers nothing to create until the list is loaded", () => {
    expect(view({ loaded: false, entries: [], typed: "BBQ" }).offer).toEqual({ kind: "none" });
    expect(view({ typed: "Grill" }).offer).toEqual({ kind: "create", name: "Grill" });
  });

  it("says one problem: the list, then a long name, then a failed create", () => {
    expect(view({ listFailed: true, failedName: "x" }).problem?.key).toBe("loadFailed");
    expect(view({ typed: "x".repeat(81), kind: "cuisine", failedName: "y" }).problem).toEqual({
      key: "tooLong",
      values: { max: 80 },
    });
    expect(view({ failedName: "Grill" }).problem).toEqual({
      key: "createFailed",
      values: { name: "Grill" },
    });
    expect(view().problem).toBeNull();
  });

  it("names the Create label by connectivity, and the entry Return picks by the fold in full", () => {
    expect(view({ offline: true }).createLabelKey).toBe("createOffline");
    expect(view().createLabelKey).toBe("create");
    expect(view({ typed: "cafe" }).exactMatch?.name).toBe("Café");
    expect(view({ typed: "caf" }).exactMatch).toBeUndefined();
    expect(view({ typed: "" }).exactMatch).toBeUndefined();
  });
});
