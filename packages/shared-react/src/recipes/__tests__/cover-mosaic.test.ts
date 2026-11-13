import { describe, expect, it } from "vitest";

import { coverMosaicColumns } from "../cover-mosaic";

describe("coverMosaicColumns", () => {
  it("lays out one to four photos", () => {
    expect(coverMosaicColumns(0)).toEqual([]);
    expect(coverMosaicColumns(1)).toEqual([[0]]);
    expect(coverMosaicColumns(2)).toEqual([[0], [1]]);
    expect(coverMosaicColumns(3)).toEqual([[0], [1, 2]]);
    expect(coverMosaicColumns(4)).toEqual([
      [0, 2],
      [1, 3],
    ]);
  });
});
