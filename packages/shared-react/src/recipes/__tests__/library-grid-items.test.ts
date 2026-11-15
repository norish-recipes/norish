import { describe, expect, it } from "vitest";

import type { LibraryItemDTO } from "@norish/shared/contracts";

import { libraryGridItems, recipeGridItems } from "../library-grid-items";

const recipe = { kind: "recipe", recipe: { id: "r1" } } as unknown as LibraryItemDTO;
const cookbook = { kind: "cookbook", cookbook: { id: "c1" } } as unknown as LibraryItemDTO;

describe("libraryGridItems", () => {
  it("puts running imports ahead of the items, in page order", () => {
    const rows = libraryGridItems([recipe, cookbook], new Set(["p1", "p2"]), "all");

    expect(rows.map((row) => `${row.kind}:${row.id}`)).toEqual([
      "pending:p1",
      "pending:p2",
      "recipe:r1",
      "cookbook:c1",
    ]);
  });

  it("leaves imports out under the Cookbooks lens", () => {
    const rows = libraryGridItems([cookbook], new Set(["p1"]), "cookbooks");

    expect(rows.map((row) => row.kind)).toEqual(["cookbook"]);
  });

  it("draws a cookbook's members as recipe rows", () => {
    const rows = recipeGridItems([{ id: "r1" }] as never);

    expect(rows).toEqual([{ kind: "recipe", id: "r1", recipe: { id: "r1" } }]);
  });
});
