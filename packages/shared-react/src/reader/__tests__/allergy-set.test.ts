import { describe, expect, it } from "vitest";

import { changesAllergies } from "../allergy-set";

describe("changesAllergies", () => {
  it("is false for the saved set in another order, case or with repeats", () => {
    expect(changesAllergies(["milk", "nuts"], ["nuts", "milk"])).toBe(false);
    expect(changesAllergies(["Nuts", " nuts "], ["nuts"])).toBe(false);
  });

  it("is true for an added, removed or emptied allergy", () => {
    expect(changesAllergies(["nuts", "milk"], ["nuts"])).toBe(true);
    expect(changesAllergies(["milk"], ["nuts", "milk"])).toBe(true);
    expect(changesAllergies([], ["nuts"])).toBe(true);
  });

  it("takes saved names as stored, never cleaning them again", () => {
    expect(changesAllergies([], ["<milk>"])).toBe(true);
    expect(changesAllergies(["<milk>"], ["<milk>"])).toBe(false);
    expect(changesAllergies(["&lt;milk&gt;"], ["<milk>"])).toBe(false);
  });
});
