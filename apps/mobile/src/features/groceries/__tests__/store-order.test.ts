import { describe, expect, it } from "vitest";

import { movedAfter } from "../utils/store-order";

describe("movedAfter", () => {
  it("places the row after the one it landed under, or first", () => {
    expect(movedAfter(["a", "b", "c"], "c", "a")).toEqual(["a", "c", "b"]);
    expect(movedAfter(["a", "b", "c"], "c", null)).toEqual(["c", "a", "b"]);
    expect(movedAfter(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
  });

  it("follows the list as it is now: a new row stays, a removed neighbour sends it first", () => {
    expect(movedAfter(["a", "new", "b"], "b", "a")).toEqual(["a", "b", "new"]);
    expect(movedAfter(["b", "c"], "c", "gone")).toEqual(["c", "b"]);
  });

  it("changes nothing for a row that is gone", () => {
    expect(movedAfter(["a", "b"], "x", "a")).toEqual(["a", "b"]);
  });
});
