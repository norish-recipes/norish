import { describe, expect, it, vi } from "vitest";

import { calculateWeight, selectWeightedRandomRecipe } from "@/server/services/recipe-randomizer";

const baseCandidate = {
  id: "recipe-1",
  name: "Test Recipe",
  image: null,
  categories: [],
  householdFavoriteCount: 0,
  householdAverageRating: null as number | null,
};

describe("recipe-randomizer", () => {
  describe("calculateWeight", () => {
    it("uses base weight for no favorites or ratings", () => {
      expect(calculateWeight(baseCandidate)).toBe(1);
    });

    it("caps favorite bonus at 1.0", () => {
      const candidate = { ...baseCandidate, householdFavoriteCount: 10 };

      expect(calculateWeight(candidate)).toBe(2);
    });

    it("applies gentler rating penalty", () => {
      const candidate = { ...baseCandidate, householdAverageRating: 2 };

      expect(calculateWeight(candidate)).toBe(0.7);
    });

    it("enforces a minimum weight", () => {
      const candidate = {
        ...baseCandidate,
        householdAverageRating: 2,
        householdFavoriteCount: -10,
      };

      expect(calculateWeight(candidate)).toBe(0.1);
    });

    it("combines favorite bonus and rating penalty", () => {
      const candidate = {
        ...baseCandidate,
        householdFavoriteCount: 3,
        householdAverageRating: 2,
      };

      expect(calculateWeight(candidate)).toBeCloseTo(1.12, 5);
    });
  });

  describe("selectWeightedRandomRecipe", () => {
    it("returns null for empty candidates", () => {
      expect(selectWeightedRandomRecipe([])).toBeNull();
    });

    it("returns the only candidate when one exists", () => {
      const candidate = { ...baseCandidate };

      expect(selectWeightedRandomRecipe([candidate])).toBe(candidate);
    });

    it("selects based on weighted randomness", () => {
      const candidates = [
        { ...baseCandidate, id: "a" },
        { ...baseCandidate, id: "b", householdFavoriteCount: 3 },
        { ...baseCandidate, id: "c" },
      ];

      // Weights: a=1.0, b=1.6 (1 + 0.6 bonus), c=1.0, total=3.6
      // After shuffle, selection depends on both shuffle order and random threshold

      // Mock to return consistent shuffle (no swaps) and then select first item
      // Fisher-Yates iterates from end: i=2 needs j in [0,2], i=1 needs j in [0,1]
      // Return values that keep original order: 0.9 -> j=2, 0.9 -> j=1 (no swaps)
      // Then final random for selection: 0.1 -> picks first item (a)
      const mockRandom = vi.spyOn(Math, "random");

      mockRandom
        .mockReturnValueOnce(0.99) // shuffle i=2: j=2 (no swap)
        .mockReturnValueOnce(0.99) // shuffle i=1: j=1 (no swap)
        .mockReturnValueOnce(0.1); // selection: 0.1 * 3.6 = 0.36, picks 'a' (weight 1.0)

      expect(selectWeightedRandomRecipe(candidates)?.id).toBe("a");

      // Reset and test selecting 'b' (middle item with higher weight)
      mockRandom
        .mockReturnValueOnce(0.99) // shuffle: no swap
        .mockReturnValueOnce(0.99) // shuffle: no swap
        .mockReturnValueOnce(0.5); // selection: 0.5 * 3.6 = 1.8, past 'a' (1.0), into 'b' (1.6)

      expect(selectWeightedRandomRecipe(candidates)?.id).toBe("b");

      // Reset and test selecting 'c' (last item)
      mockRandom
        .mockReturnValueOnce(0.99) // shuffle: no swap
        .mockReturnValueOnce(0.99) // shuffle: no swap
        .mockReturnValueOnce(0.95); // selection: 0.95 * 3.6 = 3.42, past 'a' and 'b', into 'c'

      expect(selectWeightedRandomRecipe(candidates)?.id).toBe("c");
    });

    it("falls back to uniform selection when total weight is zero", () => {
      const candidates = [
        { ...baseCandidate, id: "a", householdFavoriteCount: -10 },
        { ...baseCandidate, id: "b", householdFavoriteCount: -10 },
      ];

      vi.spyOn(Math, "random").mockReturnValue(0.75);
      expect(selectWeightedRandomRecipe(candidates)?.id).toBe("b");
    });
  });
});
