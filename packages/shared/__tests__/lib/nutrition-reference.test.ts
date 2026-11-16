import { describe, expect, it } from "vitest";

import { DAILY_REFERENCE, percentOfReference } from "@norish/shared/lib/nutrition-reference";

describe("percentOfReference", () => {
  it("rounds to whole percent of the reference", () => {
    expect(percentOfReference(238, DAILY_REFERENCE.calories)).toBe(12);
    expect(percentOfReference(24, DAILY_REFERENCE.protein)).toBe(48);
    expect(percentOfReference(14, DAILY_REFERENCE.carbs)).toBe(5);
  });

  it("passes 100 where a figure exceeds the reference", () => {
    expect(percentOfReference(140, DAILY_REFERENCE.fat)).toBe(200);
  });
});
