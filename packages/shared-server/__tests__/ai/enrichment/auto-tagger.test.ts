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
import { getTagStrategy } from "@norish/shared-server/config/server-config-loader";

const mocked = vi.hoisted(() => ({
  generateStructured: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  generateStructured: mocked.generateStructured,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getTagStrategy: vi.fn(),
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
});
