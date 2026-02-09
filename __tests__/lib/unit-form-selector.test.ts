/**
 * Unit Form Selector Tests (TDD - Tests First)
 *
 * Tests for selecting the grammatically correct unit form based on quantity.
 * Rules:
 * - quantity > 1: use plural form
 * - quantity <= 1 (including 0, 0.5, 1, null, undefined): use singular form
 */

import { describe, it, expect } from "vitest";

import { selectUnitForm, type UnitFormInfo } from "@/lib/unit-form-selector";

describe("selectUnitForm", () => {
  const unitWithBothForms: UnitFormInfo = {
    singular: "gram",
    plural: "grams",
  };

  const unitWithOnlySingular: UnitFormInfo = {
    singular: "g",
    plural: null,
  };

  const unitWithOnlyPlural: UnitFormInfo = {
    singular: null,
    plural: "grams",
  };

  const unitWithNoForms: UnitFormInfo = {
    singular: null,
    plural: null,
  };

  describe("plural selection (quantity > 1)", () => {
    it("returns plural form when quantity is 2", () => {
      expect(selectUnitForm(2, unitWithBothForms)).toBe("grams");
    });

    it("returns plural form when quantity is 1.5", () => {
      expect(selectUnitForm(1.5, unitWithBothForms)).toBe("grams");
    });

    it("returns plural form when quantity is 1.01", () => {
      expect(selectUnitForm(1.01, unitWithBothForms)).toBe("grams");
    });

    it("returns plural form when quantity is 100", () => {
      expect(selectUnitForm(100, unitWithBothForms)).toBe("grams");
    });

    it("returns plural form when quantity is 450", () => {
      expect(selectUnitForm(450, unitWithBothForms)).toBe("grams");
    });
  });

  describe("singular selection (quantity <= 1)", () => {
    it("returns singular form when quantity is 1", () => {
      expect(selectUnitForm(1, unitWithBothForms)).toBe("gram");
    });

    it("returns singular form when quantity is 1.0", () => {
      expect(selectUnitForm(1.0, unitWithBothForms)).toBe("gram");
    });

    it("returns singular form when quantity is 0.5", () => {
      expect(selectUnitForm(0.5, unitWithBothForms)).toBe("gram");
    });

    it("returns singular form when quantity is 0", () => {
      expect(selectUnitForm(0, unitWithBothForms)).toBe("gram");
    });

    it("returns singular form when quantity is negative", () => {
      expect(selectUnitForm(-1, unitWithBothForms)).toBe("gram");
    });
  });

  describe("null/undefined quantity handling", () => {
    it("returns singular form when quantity is null", () => {
      expect(selectUnitForm(null, unitWithBothForms)).toBe("gram");
    });

    it("returns singular form when quantity is undefined", () => {
      expect(selectUnitForm(undefined, unitWithBothForms)).toBe("gram");
    });
  });

  describe("fallback behavior", () => {
    it("falls back to singular when plural is unavailable and quantity > 1", () => {
      expect(selectUnitForm(2, unitWithOnlySingular)).toBe("g");
    });

    it("falls back to plural when singular is unavailable and quantity = 1", () => {
      expect(selectUnitForm(1, unitWithOnlyPlural)).toBe("grams");
    });

    it("returns null when no forms are available", () => {
      expect(selectUnitForm(1, unitWithNoForms)).toBeNull();
    });

    it("returns null when unit info is null", () => {
      expect(selectUnitForm(1, null)).toBeNull();
    });

    it("returns null when unit info is undefined", () => {
      expect(selectUnitForm(1, undefined)).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles very small quantities as singular", () => {
      expect(selectUnitForm(0.001, unitWithBothForms)).toBe("gram");
    });

    it("handles very large quantities as plural", () => {
      expect(selectUnitForm(1000000, unitWithBothForms)).toBe("grams");
    });

    it("handles quantity exactly at boundary (1.0000001) as plural", () => {
      expect(selectUnitForm(1.0000001, unitWithBothForms)).toBe("grams");
    });
  });
});
