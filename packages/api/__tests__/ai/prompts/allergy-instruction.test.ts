// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildAllergyInstruction } from "@norish/api/ai/prompts/fragments/allergies";

describe("buildAllergyInstruction", () => {
  describe("when no allergies provided", () => {
    it("returns skip instruction for undefined", () => {
      const result = buildAllergyInstruction(undefined);

      expect(result).toContain("Skip allergy/dietary tag detection");
      expect(result).toContain("Do not add any tags");
    });

    it("returns skip instruction for empty array", () => {
      const result = buildAllergyInstruction([]);

      expect(result).toContain("Skip allergy/dietary tag detection");
    });
  });

  describe("when allergies provided", () => {
    it("includes allergen list in standard mode", () => {
      const result = buildAllergyInstruction(["gluten", "dairy"]);

      expect(result).toContain("gluten, dairy");
      expect(result).toContain("Only detect these specific allergens");
      expect(result).not.toContain("STRICT");
    });

    it("includes allergen list in strict mode", () => {
      const result = buildAllergyInstruction(["gluten", "dairy", "nuts"], { strict: true });

      expect(result).toContain("gluten, dairy, nuts");
      expect(result).toContain("STRICT");
      expect(result).toContain("MUST contain ONLY items from this list");
      expect(result).toContain("NEVER add additional keywords");
    });

    it("handles single allergen", () => {
      const result = buildAllergyInstruction(["peanuts"]);

      expect(result).toContain("peanuts");
    });
  });

  describe("strict mode behavior", () => {
    it("defaults to non-strict", () => {
      const result = buildAllergyInstruction(["gluten"]);

      expect(result).not.toContain("STRICT");
    });

    it("explicit non-strict works", () => {
      const result = buildAllergyInstruction(["gluten"], { strict: false });

      expect(result).not.toContain("STRICT");
    });
  });
});
