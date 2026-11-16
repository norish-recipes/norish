import { describe, expect, it } from "vitest";

import { pantryAddRows } from "../utils/pantry-add-rows";

const olives = { id: "i-olives", name: "Olives" };
const oil = { id: "i-oil", name: "Olive oil" };

describe("pantryAddRows", () => {
  it("lists the catalogue foods, then the typed text as a custom entry", () => {
    const rows = pantryAddRows("olive", [olives, oil], true);

    expect(rows.map((row) => [row.type, row.foodId])).toEqual([
      ["match", "i-olives"],
      ["match", "i-oil"],
      ["custom", null],
    ]);
    expect(rows.at(-1)).toMatchObject({ name: "olive" });
  });

  it("rounds the first and last row of the one card", () => {
    expect(pantryAddRows("olive", [olives, oil], true).map((row) => row.edge)).toEqual([
      { top: true, bottom: false },
      { top: false, bottom: false },
      { top: false, bottom: true },
    ]);
    expect(pantryAddRows("olive", [olives], false)[0]?.edge).toEqual({ top: true, bottom: true });
  });

  it("offers no custom entry beside a food that is named as typed", () => {
    expect(pantryAddRows("Olives", [olives], true).map((row) => row.type)).toEqual(["match"]);
  });

  it("offers no custom entry for text the Pantry already keeps, and nothing for no text", () => {
    expect(pantryAddRows("olives", [olives], false).map((row) => row.type)).toEqual(["match"]);
    expect(pantryAddRows("", [], false)).toEqual([]);
  });
});
