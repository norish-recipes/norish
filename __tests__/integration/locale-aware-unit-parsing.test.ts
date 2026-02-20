import type { UnitsMap } from "@/server/db/zodSchemas/server-config";

import { describe, expect, it } from "vitest";

import defaultUnits from "@/config/units.default.json";
import { parseIngredientWithDefaults } from "@/lib/helpers";

describe("Locale-aware unit parsing integration", () => {
  const units = defaultUnits as UnitsMap;

  describe("Germanic language unit parsing", () => {
    it("parses German tablespoon", () => {
      const parsed = parseIngredientWithDefaults("2 EL Butter", units);

      expect(parsed[0].quantity).toBe(2);
      expect(parsed[0].unitOfMeasureID).toBe("tablespoon");
    });

    it("parses Dutch teaspoon", () => {
      const parsed = parseIngredientWithDefaults("1 theelepel zout", units);

      expect(parsed[0].quantity).toBe(1);
      expect(parsed[0].unitOfMeasureID).toBe("teaspoon");
    });

    it("parses English grams", () => {
      const parsed = parseIngredientWithDefaults("500 grams flour", units);

      expect(parsed[0].quantity).toBe(500);
      expect(parsed[0].unitOfMeasureID).toBe("gram");
    });
  });

  describe("Latin language unit parsing", () => {
    it("parses French grams", () => {
      const parsed = parseIngredientWithDefaults("250 g farine", units);

      expect(parsed[0].quantity).toBe(250);
      expect(parsed[0].unitOfMeasureID).toBe("gram");
    });

    it("parses Spanish grams", () => {
      const parsed = parseIngredientWithDefaults("100 g harina", units);

      expect(parsed[0].quantity).toBe(100);
      expect(parsed[0].unitOfMeasureID).toBe("gram");
    });
  });

  describe("Korean unit parsing", () => {
    it("parses Korean tablespoon", () => {
      const parsed = parseIngredientWithDefaults("2 큰술 간장", units);

      expect(parsed[0].quantity).toBe(2);
      expect(parsed[0].unitOfMeasureID).toBe("tablespoon");
    });

    it("parses Korean teaspoon", () => {
      const parsed = parseIngredientWithDefaults("1 작은술 소금", units);

      expect(parsed[0].quantity).toBe(1);
      expect(parsed[0].unitOfMeasureID).toBe("teaspoon");
    });

    it("parses Korean cup", () => {
      const parsed = parseIngredientWithDefaults("1 컵 우유", units);

      expect(parsed[0].quantity).toBe(1);
      expect(parsed[0].unitOfMeasureID).toBe("glass");
    });
  });
});
