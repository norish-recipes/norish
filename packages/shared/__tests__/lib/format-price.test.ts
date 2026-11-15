import { describe, expect, it } from "vitest";

import { formatPackSize, formatShelfPrice } from "@norish/shared/lib/format-price";

const words = {
  per: (unit: string) => `per ${unit}`,
  pieces: (count: number) => (count === 1 ? "piece" : "pieces"),
};

describe("formatShelfPrice", () => {
  it("writes the price in the shop's currency and the reader's locale", () => {
    expect(formatShelfPrice("en-US", 1.5, "EUR")).toBe("€1.50");
    expect(formatShelfPrice("nl-NL", 1.5, "EUR")).toBe("€\u00a01,50");
  });

  it("falls back to the code for a currency the runtime does not know", () => {
    expect(formatShelfPrice("en-US", 2, "not-a-code")).toBe("not-a-code 2.00");
  });
});

describe("formatPackSize", () => {
  it("says what a pack holds", () => {
    expect(formatPackSize({ quantity: 500, unit: "g", byWeight: false }, words)).toBe("500 g");
    expect(formatPackSize({ quantity: 6, unit: "piece", byWeight: false }, words)).toBe("6 pieces");
  });

  it("says per unit for what is sold loose", () => {
    expect(formatPackSize({ quantity: 1, unit: "kg", byWeight: true }, words)).toBe("per kg");
    expect(formatPackSize({ quantity: 100, unit: "g", byWeight: true }, words)).toBe("per 100 g");
  });
});
