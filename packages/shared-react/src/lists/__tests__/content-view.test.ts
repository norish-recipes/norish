import { describe, expect, it } from "vitest";

import type { ContentEntry } from "../content-view";
import { contentListView, entryAccess, renameView } from "../content-view";

let next = 0;
const entry = (name: string, extra: Partial<ContentEntry> = {}): ContentEntry => ({
  id: `e${next++}`,
  name,
  instance: false,
  version: 1,
  recipeCount: 1,
  editable: true,
  ...extra,
});
const names = (view: ReturnType<typeof contentListView>) =>
  view.sections.map((section) => [section.scope, section.entries.map((e) => e.name)]);

describe("contentListView", () => {
  const mine = [entry("BBQ"), entry("Café", { recipeCount: 0 }), entry("soup", { recipeCount: 0 })];
  const server = [entry("Italian", { instance: true, editable: false })];

  it("searches on the fold, so 'bbq' finds 'BBQ' and 'cafe' finds 'Café'", () => {
    expect(names(contentListView("tag", mine, "bbq", false))).toEqual([["household", ["BBQ"]]]);
    expect(names(contentListView("tag", mine, "CAFE", false))).toEqual([["household", ["Café"]]]);
  });

  it("keeps only the entries no recipe carries under the unused filter", () => {
    expect(names(contentListView("tag", mine, "", true))).toEqual([
      ["household", ["Café", "soup"]],
    ]);
    expect(names(contentListView("tag", mine, "so", true))).toEqual([["household", ["soup"]]]);
  });

  it("says why nothing shows: no entries, nothing unused, or no match", () => {
    expect(contentListView("tag", [], "", false).state).toBe("empty");
    expect(contentListView("tag", [entry("BBQ")], "", true).state).toBe("nothingUnused");
    expect(contentListView("tag", mine, "zzz", false).state).toBe("noMatch");
    expect(contentListView("tag", mine, "", false).state).toBe("list");
  });

  it("puts the household's entries first, the server's first for Categories", () => {
    const all = [...server, ...mine];

    expect(names(contentListView("cuisine", all, "", false)).map(([scope]) => scope)).toEqual([
      "household",
      "instance",
    ]);
    expect(names(contentListView("category", all, "", false)).map(([scope]) => scope)).toEqual([
      "instance",
      "household",
    ]);
  });

  it("titles the sections of Cuisines and Categories, not the one section of Tags", () => {
    expect(contentListView("tag", mine, "", false).titled).toBe(false);
    expect(contentListView("cuisine", mine, "", false).titled).toBe(true);
  });
});

describe("entryAccess", () => {
  it("lets a member change the household's, and only read the server's", () => {
    expect(entryAccess("tag", entry("BBQ"))).toBe("edit");
    expect(entryAccess("cuisine", entry("Italian", { instance: true, editable: false }))).toBe(
      "readOnly"
    );
  });

  it("lets an admin change the server's Cuisines, and nobody the built-in Categories", () => {
    expect(entryAccess("cuisine", entry("Italian", { instance: true, editable: true }))).toBe(
      "edit"
    );
    expect(entryAccess("category", entry("Dinner", { instance: true, editable: false }))).toBe(
      "fixed"
    );
  });
});

describe("renameView", () => {
  const diner = entry("Diner", { recipeCount: 97 });
  const dinner = entry("dinner");
  const italian = entry("Italian", { instance: true });
  const all = [diner, dinner, italian, entry("Manado")];

  it("renames to a new name, and saves nothing for the same name or an empty one", () => {
    expect(renameView("tag", all, diner, "Supper")).toMatchObject({
      action: "save",
      target: null,
      canSave: true,
    });
    expect(renameView("tag", all, diner, "Diner").canSave).toBe(false);
    expect(renameView("tag", all, diner, "  ")).toMatchObject({ canSave: false, problem: "empty" });
  });

  it("changes only the case of its own name as a rename, not a merge", () => {
    expect(renameView("tag", all, diner, "DINER")).toMatchObject({ action: "save", canSave: true });
  });

  it("merges onto the entry the new name folds onto, moving this entry's recipes", () => {
    expect(renameView("tag", all, diner, "Dinner")).toMatchObject({
      action: "merge",
      target: dinner,
      moved: 97,
      canSave: true,
    });
  });

  it("merges a household's entry onto the server's of that name", () => {
    expect(renameView("cuisine", all, entry("Italiaans"), "italian").target).toBe(italian);
  });

  it("merges a server entry only onto another server entry, never the household's", () => {
    const basque = entry("Basque", { instance: true });

    expect(renameView("cuisine", [...all, basque], basque, "manado").action).toBe("save");
    expect(
      renameView("cuisine", [...all, basque, entry("Ital", { instance: true })], basque, "ital")
        .action
    ).toBe("merge");
  });

  it("refuses a name over its kind's bound", () => {
    expect(renameView("category", all, diner, "x".repeat(41))).toMatchObject({
      problem: "tooLong",
      max: 40,
      canSave: false,
    });
    expect(renameView("tag", all, diner, "x".repeat(200)).canSave).toBe(true);
  });
});
