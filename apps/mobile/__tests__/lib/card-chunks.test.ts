import { cardChunks } from "@/features/recipes/utils/card-chunks";
import { describe, expect, it } from "vitest";

describe("cardChunks", () => {
  it("cuts the rows into runs, the last one short", () => {
    expect(cardChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(cardChunks([1, 2], 1)).toEqual([[1], [2]]);
    expect(cardChunks([], 8)).toEqual([]);
  });
});
