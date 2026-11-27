import { describe, expect, it } from "vitest";

import { formatBringLine } from "@norish/shared-server/bring/format-line";

describe("formatBringLine", () => {
  it("writes amount, unit and name", () => {
    expect(formatBringLine({ name: "Mehl", amount: 200, unit: "g" })).toBe("200 g Mehl");
  });

  it("rounds an amount to two decimals and trims trailing zeros", () => {
    expect(formatBringLine({ name: "Milch", amount: 0.5, unit: "l" })).toBe("0.5 l Milch");
    expect(formatBringLine({ name: "Zwiebel", amount: 1.333333, unit: null })).toBe("1.33 Zwiebel");
    expect(formatBringLine({ name: "Eier", amount: 2.0, unit: null })).toBe("2 Eier");
    expect(formatBringLine({ name: "Salz", amount: 1.999, unit: "g" })).toBe("2 g Salz");
  });

  it("leaves out a missing amount or unit", () => {
    expect(formatBringLine({ name: "Salz" })).toBe("Salz");
    expect(formatBringLine({ name: "Salz", amount: null, unit: "Prise" })).toBe("Prise Salz");
  });

  it("leaves out an amount that is zero, negative, rounds to zero or is not a number", () => {
    expect(formatBringLine({ name: "Salz", amount: 0, unit: "g" })).toBe("g Salz");
    expect(formatBringLine({ name: "Salz", amount: -2 })).toBe("Salz");
    expect(formatBringLine({ name: "Salz", amount: 0.004 })).toBe("Salz");
    expect(formatBringLine({ name: "Salz", amount: Number.NaN })).toBe("Salz");
    expect(formatBringLine({ name: "Salz", amount: 1e21 })).toBe("Salz");
    expect(formatBringLine({ name: "Salz", amount: 0.005 })).toBe("0.01 Salz");
  });

  it("collapses whitespace and newlines", () => {
    expect(formatBringLine({ name: "  rote \n\n Zwiebel\t ", amount: 2, unit: " " })).toBe(
      "2 rote Zwiebel"
    );
  });

  it("caps a line at 200 characters", () => {
    const line = formatBringLine({ name: "x".repeat(500), amount: 1, unit: "g" });

    expect(line).toHaveLength(200);
    expect(line.startsWith("1 g x")).toBe(true);
  });
});
