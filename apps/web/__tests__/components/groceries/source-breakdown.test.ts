import { formatInlineSourceBreakdown } from "@/components/groceries/grouped-grocery-item";
import { describe, expect, it } from "vitest";

import type { GroupedGrocerySource } from "@norish/shared/lib/grocery-grouping";

const source = (recipeName: string | null, amount: number | null, unit: string | null = null) =>
  ({ recipeName, grocery: { amount, unit } }) as unknown as GroupedGrocerySource;
const format = (amount: number | null | undefined, unit: string | null | undefined) =>
  amount == null ? "" : `${amount}${unit ?? "×"}`;

describe("formatInlineSourceBreakdown", () => {
  it("names the lines added by hand once, with their amounts together", () => {
    expect(
      formatInlineSourceBreakdown([source(null, 2), source(null, 1)], format, "Manual Items")
    ).toBe("Manual Items (2×, 1×)");
  });

  it("keeps each recipe's own entry and puts the hand-added ones last", () => {
    expect(
      formatInlineSourceBreakdown(
        [source(null, 1), source("Rendang", 300, "g"), source("Soep", null)],
        format,
        "Manual Items"
      )
    ).toBe("Rendang (300g), Soep, Manual Items (1×)");
  });

  it("counts a hand-added line without an amount as one, as the group's total does", () => {
    expect(
      formatInlineSourceBreakdown([source(null, 2), source(null, null)], format, "Manual Items")
    ).toBe("Manual Items (2×, 1×)");
  });
});
