/**
 * Auto-Tagger Tests
 *
 * The AI Runtime is the single mocked AI seam. The tags repository stays
 * mocked as a genuine data dependency: which stored tags the model may reuse
 * is the feature's own domain input.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listAllTagNames } from "@norish/db/repositories/tags";
import { AIDisabledError } from "@norish/shared-server/ai/runtime/errors";
import {
  getTagStrategy,
  isDecisionModelConfigured,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";

const mocked = vi.hoisted(() => ({
  generateStructured: vi.fn(),
  decide: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  generateStructured: mocked.generateStructured,
  decide: mocked.decide,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getTagStrategy: vi.fn(),
  isDecisionModelConfigured: vi.fn(),
  isDecisionUseEnabled: vi.fn(),
}));

vi.mock("@norish/db/repositories/tags", () => ({
  listAllTagNames: vi.fn(),
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { generateTagsForRecipe } = await import("@norish/shared-server/ai/enrichment/auto-tagger");

describe("Auto-Tagger", () => {
  const mockRecipe = {
    title: "Spaghetti Carbonara",
    description: "Classic Italian pasta dish",
    ingredients: ["spaghetti", "eggs", "pancetta", "parmesan", "black pepper"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTagStrategy).mockResolvedValue("predefined");
    mocked.generateStructured.mockResolvedValue({ tags: [] });
    // No Decision Model for validation unless a test says otherwise: every
    // claim is kept unjudged.
    vi.mocked(isDecisionModelConfigured).mockResolvedValue(false);
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(true);
  });

  describe("generateTagsForRecipe", () => {
    it("propagates the runtime's refusal when AI is disabled", async () => {
      mocked.generateStructured.mockRejectedValue(new AIDisabledError());

      await expect(generateTagsForRecipe(mockRecipe)).rejects.toBeInstanceOf(AIDisabledError);
    });

    it("still generates tags when automatic auto-tagging is switched off", async () => {
      // The automatic switch is coordination policy; it must not disable the manual tool.
      mocked.generateStructured.mockResolvedValue({ tags: ["Italian"] });

      const tags = await generateTagsForRecipe(mockRecipe);

      expect(tags).toEqual(["italian"]);
    });

    it("refuses a recipe with no ingredients", async () => {
      await expect(
        generateTagsForRecipe({ title: "Empty Recipe", ingredients: [] })
      ).rejects.toThrow("No ingredients provided");
      expect(mocked.generateStructured).not.toHaveBeenCalled();
    });

    it("runs under the administrator-editable auto-tagging prompt", async () => {
      mocked.generateStructured.mockResolvedValue({ tags: ["Italian"] });

      await generateTagsForRecipe(mockRecipe);

      expect(mocked.generateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "auto-tagging",
          sections: expect.arrayContaining([expect.stringContaining("Spaghetti Carbonara")]),
        })
      );
    });

    it("successfully generates tags in predefined mode", async () => {
      mocked.generateStructured.mockResolvedValue({ tags: ["Italian", "Pasta", "Quick"] });

      const tags = await generateTagsForRecipe(mockRecipe);

      expect(tags).toEqual(["italian", "pasta", "quick"]);
    });

    it("fetches existing tags and offers them to the model in predefined_db mode", async () => {
      vi.mocked(getTagStrategy).mockResolvedValue("predefined_db");
      vi.mocked(listAllTagNames).mockResolvedValue(["dinner", "italian", "vegetarian"]);
      mocked.generateStructured.mockResolvedValue({ tags: ["Italian", "Dinner"] });

      const tags = await generateTagsForRecipe(mockRecipe);

      expect(listAllTagNames).toHaveBeenCalled();
      expect(mocked.generateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.stringContaining("dinner, italian, vegetarian"),
          ]),
        })
      );
      expect(tags).toEqual(["italian", "dinner"]);
    });

    it("does not fetch DB tags in predefined mode", async () => {
      await generateTagsForRecipe(mockRecipe);

      expect(listAllTagNames).not.toHaveBeenCalled();
    });

    it("normalizes tags (lowercase, trim, deduplicate)", async () => {
      vi.mocked(getTagStrategy).mockResolvedValue("freeform");
      mocked.generateStructured.mockResolvedValue({
        tags: ["  PASTA  ", "Italian", "pasta", "Quick ", ""],
      });

      const tags = await generateTagsForRecipe(mockRecipe);

      // Should be lowercase, trimmed, deduplicated, empty strings removed
      expect(tags).toEqual(["pasta", "italian", "quick"]);
    });

    it("lets an AI failure out for the caller to handle", async () => {
      mocked.generateStructured.mockRejectedValue(new Error("API rate limit exceeded"));

      await expect(generateTagsForRecipe(mockRecipe)).rejects.toThrow("API rate limit exceeded");
    });
  });

  describe("Enrichment Validation", () => {
    /** The validation Decision: one probability per claim id. */
    function verdicts(probabilities: Record<string, number>) {
      return {
        model: "jev",
        answers: Object.fromEntries(
          Object.entries(probabilities).map(([id, probability]) => [
            id,
            { type: "boolean", probability },
          ])
        ),
      };
    }

    beforeEach(() => {
      vi.mocked(isDecisionModelConfigured).mockResolvedValue(true);
    });

    it("checks only the tags this run proposed, and writes the survivors", async () => {
      mocked.generateStructured.mockResolvedValue({ tags: ["Italian", "Quick", "Vegan"] });
      mocked.decide.mockResolvedValue(verdicts({ italian: 0.9, quick: 0.8, vegan: 0.02 }));

      const tags = await generateTagsForRecipe(mockRecipe);

      expect(mocked.decide).toHaveBeenCalledTimes(1);
      expect(mocked.decide).toHaveBeenCalledWith({
        feature: "auto-tagging:validation",
        state: {
          title: "Spaghetti Carbonara",
          description: "Classic Italian pasta dish",
          ingredients: mockRecipe.ingredients,
        },
        questions: {
          italian: { type: "boolean", instructions: expect.stringMatching(/"italian"/) },
          quick: { type: "boolean", instructions: expect.stringMatching(/"quick"/) },
          vegan: { type: "boolean", instructions: expect.stringMatching(/"vegan"/) },
        },
      });
      expect(tags).toEqual(["italian", "quick"]);
    });

    it("never hands stored tags to validation: a person's tag is not in the run's claims", async () => {
      // predefined_db offers the instance's stored tags to the model as
      // input; they are not claims, so a stored "vegetarian" that the model
      // did not propose is never judged and cannot be dropped.
      vi.mocked(getTagStrategy).mockResolvedValue("predefined_db");
      vi.mocked(listAllTagNames).mockResolvedValue(["vegetarian", "dinner"]);
      mocked.generateStructured.mockResolvedValue({ tags: ["Italian"] });
      mocked.decide.mockResolvedValue(verdicts({ italian: 0.9, vegetarian: 0.01 }));

      await expect(generateTagsForRecipe(mockRecipe)).resolves.toEqual(["italian"]);
      expect(Object.keys(mocked.decide.mock.calls[0]?.[0].questions)).toEqual(["italian"]);
    });

    it("returns an empty list when every claim was dropped, leaving the worker's rule to it", async () => {
      mocked.generateStructured.mockResolvedValue({ tags: ["Nonsense"] });
      mocked.decide.mockResolvedValue(verdicts({ nonsense: 0.01 }));

      await expect(generateTagsForRecipe(mockRecipe)).resolves.toEqual([]);
    });

    it("keeps a disputed tag when the Validate enrichments use is off: the verdict is only logged", async () => {
      vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
      mocked.generateStructured.mockResolvedValue({ tags: ["Nonsense"] });
      mocked.decide.mockResolvedValue(verdicts({ nonsense: 0.01 }));

      await expect(generateTagsForRecipe(mockRecipe)).resolves.toEqual(["nonsense"]);
      expect(vi.mocked(isDecisionUseEnabled)).toHaveBeenCalledWith("validateEnrichments");
    });
  });
});
