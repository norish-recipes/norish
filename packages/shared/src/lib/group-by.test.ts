import { describe, expect, it } from "vitest";

import { groupBy } from "./group-by";

describe("groupBy", () => {
  it("groups rows by key in the order first seen, as they are or as `value` keeps them", () => {
    const rows = [
      { household: "b", id: 1 },
      { household: "a", id: 2 },
      { household: "b", id: 3 },
    ];

    expect([...groupBy(rows, (row) => row.household)]).toEqual([
      ["b", [rows[0], rows[2]]],
      ["a", [rows[1]]],
    ]);
    expect([
      ...groupBy(
        rows,
        (row) => row.household,
        (row) => row.id
      ),
    ]).toEqual([
      ["b", [1, 3]],
      ["a", [2]],
    ]);
  });
});
