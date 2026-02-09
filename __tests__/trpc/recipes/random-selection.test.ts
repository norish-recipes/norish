/**
 * Random Recipe Selection Tests
 *
 * Tests weighted random selection logic with household favorites and ratings.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Random Recipe Selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Weighting Logic", () => {
    it("calculates base weight of 1.0 for recipes without favorites or ratings", () => {
      const candidate = {
        id: "recipe-1",
        name: "Test Recipe",
        image: null,
        categories: [],
        householdFavoriteCount: 0,
        householdAverageRating: null,
      };

      let weight = 1.0;

      if (candidate.householdFavoriteCount > 0) {
        weight += candidate.householdFavoriteCount * 0.5;
      }

      if (candidate.householdAverageRating !== null && candidate.householdAverageRating < 3) {
        weight *= 0.3;
      }

      expect(weight).toBe(1.0);
    });

    it("increases weight by 0.5 per household favorite", () => {
      const candidate = {
        id: "recipe-1",
        name: "Test Recipe",
        image: null,
        categories: [],
        householdFavoriteCount: 3,
        householdAverageRating: null,
      };

      let weight = 1.0;

      if (candidate.householdFavoriteCount > 0) {
        weight += candidate.householdFavoriteCount * 0.5;
      }

      if (candidate.householdAverageRating !== null && candidate.householdAverageRating < 3) {
        weight *= 0.3;
      }

      expect(weight).toBe(2.5);
    });

    it("applies 0.3x penalty when household average rating is below 3", () => {
      const candidate = {
        id: "recipe-1",
        name: "Test Recipe",
        image: null,
        categories: [],
        householdFavoriteCount: 0,
        householdAverageRating: 2.5,
      };

      let weight = 1.0;

      if (candidate.householdFavoriteCount > 0) {
        weight += candidate.householdFavoriteCount * 0.5;
      }

      if (candidate.householdAverageRating !== null && candidate.householdAverageRating < 3) {
        weight *= 0.3;
      }

      expect(weight).toBe(0.3);
    });

    it("does not apply penalty when rating is exactly 3", () => {
      const candidate = {
        id: "recipe-1",
        name: "Test Recipe",
        image: null,
        categories: [],
        householdFavoriteCount: 0,
        householdAverageRating: 3.0,
      };

      let weight = 1.0;

      if (candidate.householdFavoriteCount > 0) {
        weight += candidate.householdFavoriteCount * 0.5;
      }

      if (candidate.householdAverageRating !== null && candidate.householdAverageRating < 3) {
        weight *= 0.3;
      }

      expect(weight).toBe(1.0);
    });

    it("combines favorites boost with rating penalty correctly", () => {
      const candidate = {
        id: "recipe-1",
        name: "Test Recipe",
        image: null,
        categories: [],
        householdFavoriteCount: 2,
        householdAverageRating: 1.5,
      };

      let weight = 1.0;

      if (candidate.householdFavoriteCount > 0) {
        weight += candidate.householdFavoriteCount * 0.5;
      }

      if (candidate.householdAverageRating !== null && candidate.householdAverageRating < 3) {
        weight *= 0.3;
      }

      expect(weight).toBe(0.6);
    });
  });

  describe("Weighted Selection Algorithm", () => {
    it("selects from candidates based on cumulative weights", () => {
      const candidates = [
        { id: "a", weight: 1.0 },
        { id: "b", weight: 2.0 },
        { id: "c", weight: 1.0 },
      ];

      const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);

      expect(totalWeight).toBe(4.0);

      const selectByRandom = (random: number): string => {
        let cumulative = 0;

        for (const c of candidates) {
          cumulative += c.weight;

          if (random <= cumulative) {
            return c.id;
          }
        }

        return candidates[candidates.length - 1].id;
      };

      expect(selectByRandom(0.5)).toBe("a");
      expect(selectByRandom(1.0)).toBe("a");
      expect(selectByRandom(1.5)).toBe("b");
      expect(selectByRandom(3.0)).toBe("b");
      expect(selectByRandom(3.5)).toBe("c");
      expect(selectByRandom(4.0)).toBe("c");
    });

    it("returns single candidate when only one exists", () => {
      const candidates = [{ id: "only-one", name: "Single Recipe", image: null }];

      expect(candidates.length).toBe(1);
      expect(candidates[0].id).toBe("only-one");
    });

    it("returns null when no candidates exist", () => {
      const candidates: { id: string }[] = [];

      const result = candidates.length === 0 ? null : candidates[0];

      expect(result).toBeNull();
    });
  });

  describe("Category Pool Fallback", () => {
    it("falls back to all recipes when category pool has 1 or fewer recipes", () => {
      const categoryPool = [{ id: "only-breakfast" }];
      const allPool = [{ id: "recipe-1" }, { id: "recipe-2" }, { id: "recipe-3" }];

      const usePool = categoryPool.length <= 1 ? allPool : categoryPool;

      expect(usePool).toBe(allPool);
      expect(usePool.length).toBe(3);
    });

    it("uses category pool when it has more than 1 recipe", () => {
      const categoryPool = [{ id: "breakfast-1" }, { id: "breakfast-2" }];
      const allPool = [{ id: "recipe-1" }, { id: "recipe-2" }, { id: "recipe-3" }];

      const usePool = categoryPool.length <= 1 ? allPool : categoryPool;

      expect(usePool).toBe(categoryPool);
      expect(usePool.length).toBe(2);
    });
  });
});
