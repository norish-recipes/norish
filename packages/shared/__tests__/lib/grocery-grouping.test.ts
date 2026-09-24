/**
 * What makes one row of the grouped list: one name, measured one way, at one
 * Store, under one aisle. The unit is part of it because a group states a
 * single total, and 300 g heavy cream plus a heavy cream with no measure is
 * not 301 g of anything (#562).
 */
import { describe, expect, it } from "vitest";

import type { GroceryDto } from "@norish/shared/contracts";
import { groupGroceriesByIngredient } from "@norish/shared/lib/grocery-grouping";

let nextSortOrder = 0;

function grocery(
  name: string,
  amount: number | null = null,
  unit: string | null = null,
  storeId: string | null = "store-a"
): GroceryDto {
  nextSortOrder += 1;

  return {
    id: `${name}|${amount ?? ""}|${unit ?? ""}|${nextSortOrder}`,
    name,
    amount,
    unit,
    isDone: false,
    storeId,
    sortOrder: nextSortOrder,
  } as unknown as GroceryDto;
}

/** The groups of one Store, as the list shows them. */
function groupsOf(
  groceries: GroceryDto[],
  aisleOf?: (grocery: GroceryDto) => string | null,
  storeId: string | null = "store-a"
) {
  return groupGroceriesByIngredient(groceries, () => null, undefined, aisleOf).get(storeId) ?? [];
}

/** What a group says it is: its total, its unit, and how many lines are under it. */
const shapeOf = (groups: ReturnType<typeof groupsOf>) =>
  groups.map((group) => ({
    name: group.displayName,
    totalAmount: group.totalAmount,
    displayUnit: group.displayUnit,
    sources: group.sources.length,
  }));

describe("groupGroceriesByIngredient", () => {
  it("keeps a measured line and an unmeasured one of the same name apart", () => {
    const groups = groupsOf([grocery("heavy cream"), grocery("heavy cream", 300, "g")]);

    expect(shapeOf(groups)).toEqual([
      { name: "heavy cream", totalAmount: 1, displayUnit: null, sources: 1 },
      { name: "heavy cream", totalAmount: 300, displayUnit: "gram", sources: 1 },
    ]);
  });

  it("adds up what is measured the same way, however the unit is written", () => {
    const groups = groupsOf([
      grocery("bloem", 300, "g"),
      grocery("bloem", 200, "gram"),
      grocery("bloem", 100, "grams"),
    ]);

    expect(shapeOf(groups)).toEqual([
      { name: "bloem", totalAmount: 600, displayUnit: "gram", sources: 3 },
    ]);
  });

  it("gives every measure of one name its own row", () => {
    const groups = groupsOf([grocery("melk", 300, "g"), grocery("melk", 200, "ml")]);

    expect(shapeOf(groups)).toEqual([
      { name: "melk", totalAmount: 300, displayUnit: "gram", sources: 1 },
      { name: "melk", totalAmount: 200, displayUnit: "milliliter", sources: 1 },
    ]);
    expect(new Set(groups.map((group) => group.groupKey)).size).toBe(2);
  });

  it("counts a line that states no amount as one of what its group counts", () => {
    const groups = groupsOf([grocery("citroen"), grocery("citroen", 2), grocery("citroen")]);

    expect(shapeOf(groups)).toEqual([
      { name: "citroen", totalAmount: 4, displayUnit: null, sources: 3 },
    ]);
  });

  it("folds a qualifier into the name it qualifies, when both are measured the same", () => {
    const groups = groupsOf([grocery("kip", 500, "g"), grocery("kip (diepvries)", 300, "g")]);

    expect(shapeOf(groups)).toEqual([
      { name: "kip", totalAmount: 800, displayUnit: "gram", sources: 2 },
    ]);
  });

  it("never lets a group straddle two aisles, whatever it is measured in", () => {
    const vers = grocery("kip", 500, "g");
    const diepvries = grocery("kip (diepvries)", 300, "g");
    const groups = groupsOf([vers, diepvries], (item) =>
      item.id === diepvries.id ? "aisle-frozen" : "aisle-meat"
    );

    expect(shapeOf(groups)).toEqual([
      { name: "kip", totalAmount: 500, displayUnit: "gram", sources: 1 },
      { name: "kip", totalAmount: 300, displayUnit: "gram", sources: 1 },
    ]);
    expect(groups.map((group) => group.aisleId)).toEqual(["aisle-meat", "aisle-frozen"]);
  });

  it("groups within a Store, never across two", () => {
    const grouped = groupGroceriesByIngredient(
      [grocery("melk", 1, "l"), grocery("melk", 1, "l", "store-b")],
      () => null
    );

    expect(grouped.get("store-a")).toHaveLength(1);
    expect(grouped.get("store-b")).toHaveLength(1);
    expect(grouped.get("store-a")?.[0]?.totalAmount).toBe(1);
  });
});
