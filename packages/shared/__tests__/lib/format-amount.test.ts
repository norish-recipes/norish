import { describe, expect, it } from "vitest";

import {
  formatAmount,
  formatAmountAsDecimal,
  formatAmountAsFraction,
} from "@norish/shared/lib/format-amount";

describe("formatAmountAsDecimal", () => {
  it("returns empty string for null", () => {
    expect(formatAmountAsDecimal(null)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(formatAmountAsDecimal("")).toBe("");
  });

  it("returns original value for NaN", () => {
    expect(formatAmountAsDecimal("abc")).toBe("abc");
  });

  it("formats whole numbers without decimals", () => {
    expect(formatAmountAsDecimal(2)).toBe("2");
    expect(formatAmountAsDecimal(10)).toBe("10");
  });

  it("removes trailing zeros", () => {
    expect(formatAmountAsDecimal(2.5)).toBe("2.5");
    expect(formatAmountAsDecimal(2.5)).toBe("2.5");
    expect(formatAmountAsDecimal(1.25)).toBe("1.25");
  });

  it("handles string input", () => {
    expect(formatAmountAsDecimal("2.5")).toBe("2.5");
    expect(formatAmountAsDecimal("3")).toBe("3");
  });

  it("handles very small decimals", () => {
    expect(formatAmountAsDecimal(0.25)).toBe("0.25");
    expect(formatAmountAsDecimal(0.125)).toBe("0.13"); // toFixed(2) rounds
  });
});

describe("formatAmountAsFraction", () => {
  it("returns empty string for null", () => {
    expect(formatAmountAsFraction(null)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(formatAmountAsFraction("")).toBe("");
  });

  it("returns original value for NaN", () => {
    expect(formatAmountAsFraction("abc")).toBe("abc");
  });

  it("formats whole numbers without fractions", () => {
    expect(formatAmountAsFraction(2)).toBe("2");
    expect(formatAmountAsFraction(10)).toBe("10");
  });

  describe("common cooking fractions", () => {
    it("formats 1/2", () => {
      expect(formatAmountAsFraction(0.5)).toBe("½");
    });

    it("formats 1/4", () => {
      expect(formatAmountAsFraction(0.25)).toBe("¼");
    });

    it("formats 3/4", () => {
      expect(formatAmountAsFraction(0.75)).toBe("¾");
    });

    it("formats 1/3", () => {
      expect(formatAmountAsFraction(0.333)).toBe("⅓");
      expect(formatAmountAsFraction(0.3333)).toBe("⅓");
    });

    it("formats 2/3", () => {
      expect(formatAmountAsFraction(0.666)).toBe("⅔");
      expect(formatAmountAsFraction(0.6667)).toBe("⅔");
    });

    it("formats 1/8", () => {
      expect(formatAmountAsFraction(0.125)).toBe("⅛");
    });

    it("formats 3/8", () => {
      expect(formatAmountAsFraction(0.375)).toBe("⅜");
    });

    it("formats 5/8", () => {
      expect(formatAmountAsFraction(0.625)).toBe("⅝");
    });

    it("formats 7/8", () => {
      expect(formatAmountAsFraction(0.875)).toBe("⅞");
    });
  });

  describe("mixed numbers", () => {
    it("formats 1 1/2", () => {
      expect(formatAmountAsFraction(1.5)).toBe("1 ½");
    });

    it("formats 2 1/4", () => {
      expect(formatAmountAsFraction(2.25)).toBe("2 ¼");
    });

    it("formats 2 3/4", () => {
      expect(formatAmountAsFraction(2.75)).toBe("2 ¾");
    });

    it("formats 3 1/3", () => {
      expect(formatAmountAsFraction(3.333)).toBe("3 ⅓");
    });
  });

  describe("fallback behavior", () => {
    it("uses decimal for numbers that simplify to large denominators", () => {
      // Numbers that don't simplify to common cooking fractions
      // The library uses a 0.01 tolerance, so some unusual decimals may still
      // get converted to nearby fractions. This test documents actual behavior.
      expect(formatAmountAsFraction(0.05)).toBe("0.05"); // 1/20 has denominator > 16
    });
  });

  describe("string input", () => {
    it("handles string input", () => {
      expect(formatAmountAsFraction("0.5")).toBe("½");
      expect(formatAmountAsFraction("1.5")).toBe("1 ½");
      expect(formatAmountAsFraction("2")).toBe("2");
    });
  });

  describe("negative numbers", () => {
    it("handles negative fractions", () => {
      expect(formatAmountAsFraction(-0.5)).toBe("-½");
      expect(formatAmountAsFraction(-1.5)).toBe("-1 ½");
    });
  });
});

describe("formatAmount", () => {
  it("uses decimal mode by default", () => {
    expect(formatAmount(0.5)).toBe("0.5");
    expect(formatAmount(1.5)).toBe("1.5");
  });

  it("uses decimal mode when specified", () => {
    expect(formatAmount(0.5, "decimal")).toBe("0.5");
    expect(formatAmount(1.5, "decimal")).toBe("1.5");
  });

  it("uses fraction mode when specified", () => {
    expect(formatAmount(0.5, "fraction")).toBe("½");
    expect(formatAmount(1.5, "fraction")).toBe("1 ½");
  });

  it("handles null in both modes", () => {
    expect(formatAmount(null, "decimal")).toBe("");
    expect(formatAmount(null, "fraction")).toBe("");
  });
});
