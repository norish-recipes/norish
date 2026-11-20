import { describe, expect, it } from "vitest";

import { libraryListInput } from "../../src/contracts/list-queries";

describe("libraryListInput", () => {
  it("leaves sortBeatsRank out unless set, so other callers' input is unchanged", () => {
    expect(libraryListInput({})).not.toHaveProperty("sortBeatsRank");
    expect(libraryListInput({ sortBeatsRank: false })).not.toHaveProperty("sortBeatsRank");
  });

  it("sends it when Search sets it", () => {
    expect(libraryListInput({ sortBeatsRank: true })).toMatchObject({ sortBeatsRank: true });
  });
});
