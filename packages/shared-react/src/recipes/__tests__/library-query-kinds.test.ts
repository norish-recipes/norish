import { describe, expect, it } from "vitest";

import type { LibraryTypeFilter } from "@norish/shared/contracts";
import { libraryListInput } from "@norish/shared/contracts/list-queries";

import { libraryQueryHolds } from "../library-cache";

// The key tRPC builds for the Library query: its input is `libraryListInput`'s own.
const key = (type?: LibraryTypeFilter) => [
  ["library", "list"],
  { input: libraryListInput(type ? { type } : {}), type: "infinite" },
];

describe("libraryQueryHolds", () => {
  it("keeps recipes out of the Cookbooks lens and cookbooks out of the Recipes lens", () => {
    expect(libraryQueryHolds(key("cookbooks"), "recipe")).toBe(false);
    expect(libraryQueryHolds(key("recipes"), "cookbook")).toBe(false);
  });

  it("holds both kinds in All, in an unfiltered list, and its own kind in its lens", () => {
    expect(libraryQueryHolds(key("all"), "recipe")).toBe(true);
    expect(libraryQueryHolds(key("all"), "cookbook")).toBe(true);
    expect(libraryQueryHolds(key(), "recipe")).toBe(true);
    expect(libraryQueryHolds(key("recipes"), "recipe")).toBe(true);
    expect(libraryQueryHolds(key("cookbooks"), "cookbook")).toBe(true);
  });
});
