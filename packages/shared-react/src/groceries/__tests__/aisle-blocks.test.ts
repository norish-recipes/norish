import { describe, expect, it } from "vitest";

import { placeInAisles } from "../aisle-blocks";

const store = {
  aisles: [
    { id: "b", storeId: "s", name: "Bakery", sortOrder: 1 },
    { id: "a", storeId: "s", name: "Aisle one", sortOrder: 0 },
  ],
};
const ids = (rows: { id: string; aisle: string | null }[]) => rows.map((row) => row.id);

describe("placeInAisles", () => {
  const rows = [
    { id: "1", aisle: "b" },
    { id: "2", aisle: null },
    { id: "3", aisle: "a" },
    { id: "4", aisle: "gone" },
    { id: "5", aisle: "b" },
  ];

  it("files each row under its aisle, the aisles in the Store's order, rows in the order given", () => {
    const { unfiled, blocks } = placeInAisles(store, rows, (row) => row.aisle);

    expect(blocks.map((block) => [block.aisle.id, ids(block.rows)])).toEqual([
      ["a", ["3"]],
      ["b", ["1", "5"]],
    ]);
    expect(ids(unfiled)).toEqual(["2", "4"]);
  });

  it("keeps an aisle with nothing filed under it", () => {
    const { blocks } = placeInAisles(store, [], () => null);

    expect(blocks.map((block) => block.rows)).toEqual([[], []]);
  });

  it("leaves every row unfiled where there is no Store", () => {
    const { unfiled, blocks } = placeInAisles(null, rows, (row) => row.aisle);

    expect(ids(unfiled)).toEqual(["1", "2", "3", "4", "5"]);
    expect(blocks).toEqual([]);
  });
});
