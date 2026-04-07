/**
 * Auto-Tagging Prompt Builder Tests
 *
 * Tests for buildAutoTaggingPrompt function that constructs
 * prompts for AI-based recipe tagging.
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildAutoTaggingPrompt } from "@norish/api/ai/prompts/builder";
import { getAutoTaggingMode } from "@norish/config/server-config-loader";
import { listAllTagNames } from "@norish/db/repositories/tags";
import { loadPrompt } from "@norish/shared-server/ai/prompts/loader";

// Mock dependencies before imports
vi.mock("@norish/config/server-config-loader", () => ({
  getAutoTaggingMode: vi.fn(),
}));

vi.mock("@norish/db/repositories/tags", () => ({
  listAllTagNames: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/prompts/loader", () => ({
  loadPrompt: vi.fn(),
  fillPrompt: vi.fn((template, _vars) => template),
}));

describe("buildAutoTaggingPrompt", () => {
  const mockRecipe = {
    title: "Spaghetti Carbonara",
    description: "Classic Italian pasta dish",
    ingredients: ["spaghetti", "eggs", "pancetta", "parmesan", "black pepper"],
  };

  const mockBasePrompt = `Analyze the recipe and assign relevant tags.

PREDEFINED TAGS:
- italian, mexican, asian, american
- vegetarian, vegan, gluten-free
- quick, easy, comfort-food`;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadPrompt).mockResolvedValue(mockBasePrompt);
  });

  describe("when auto-tagging is disabled", () => {
    it("returns empty string", async () => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("disabled");

      const result = await buildAutoTaggingPrompt({});

      expect(result).toBe("");
      expect(loadPrompt).not.toHaveBeenCalled();
    });

    it("returns empty string for embedded mode", async () => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("disabled");

      const result = await buildAutoTaggingPrompt({ embedded: true });

      expect(result).toBe("");
    });

    it("returns empty string for standalone mode", async () => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("disabled");

      const result = await buildAutoTaggingPrompt({ embedded: false }, mockRecipe);

      expect(result).toBe("");
    });
  });

  describe("predefined mode", () => {
    beforeEach(() => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined");
    });

    it("loads auto-tagging prompt template", async () => {
      await buildAutoTaggingPrompt({ embedded: true });

      expect(loadPrompt).toHaveBeenCalledWith("auto-tagging");
    });

    it("returns embedded instructions for extraction prompts", async () => {
      const result = await buildAutoTaggingPrompt({ embedded: true });

      expect(result).toContain("TAGGING INSTRUCTIONS");
      expect(result).toContain("keywords");
      expect(result).toContain(mockBasePrompt);
    });

    it("does not fetch DB tags in predefined mode", async () => {
      await buildAutoTaggingPrompt({ embedded: true });

      expect(listAllTagNames).not.toHaveBeenCalled();
    });

    it("returns standalone prompt with recipe context", async () => {
      const result = await buildAutoTaggingPrompt({ embedded: false }, mockRecipe);

      expect(result).toContain(mockBasePrompt);
      expect(result).toContain("RECIPE TO ANALYZE");
      expect(result).toContain("Spaghetti Carbonara");
      expect(result).toContain("Classic Italian pasta dish");
      expect(result).toContain("- spaghetti");
      expect(result).toContain("- eggs");
      expect(result).toContain("JSON object");
    });

    it("includes ingredients list formatted as bullet points", async () => {
      const result = await buildAutoTaggingPrompt({ embedded: false }, mockRecipe);

      expect(result).toContain("- spaghetti");
      expect(result).toContain("- eggs");
      expect(result).toContain("- pancetta");
      expect(result).toContain("- parmesan");
      expect(result).toContain("- black pepper");
    });

    it("throws error when recipe is missing for standalone mode", async () => {
      await expect(buildAutoTaggingPrompt({ embedded: false })).rejects.toThrow(
        "Recipe data required for standalone auto-tagging prompt"
      );
    });
  });

  describe("predefined_db mode", () => {
    beforeEach(() => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined_db");
    });

    it("fetches existing tags from database", async () => {
      vi.mocked(listAllTagNames).mockResolvedValue(["dinner", "lunch", "breakfast"]);

      await buildAutoTaggingPrompt({ embedded: true });

      expect(listAllTagNames).toHaveBeenCalled();
    });

    it("includes existing DB tags in prompt", async () => {
      vi.mocked(listAllTagNames).mockResolvedValue(["dinner", "lunch", "breakfast"]);

      const result = await buildAutoTaggingPrompt({ embedded: true });

      expect(result).toContain("ADDITIONAL ALLOWED TAGS");
      expect(result).toContain("dinner, lunch, breakfast");
    });

    it("uses pre-fetched tags if provided", async () => {
      const providedTags = ["custom-tag-1", "custom-tag-2"];

      const result = await buildAutoTaggingPrompt({ embedded: true, existingDbTags: providedTags });

      expect(listAllTagNames).not.toHaveBeenCalled();
      expect(result).toContain("custom-tag-1, custom-tag-2");
    });

    it("handles empty DB tags gracefully", async () => {
      vi.mocked(listAllTagNames).mockResolvedValue([]);

      const result = await buildAutoTaggingPrompt({ embedded: true });

      expect(result).not.toContain("ADDITIONAL ALLOWED TAGS");
    });
  });

  describe("freeform mode", () => {
    beforeEach(() => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("freeform");
    });

    it("includes note about creating new tags", async () => {
      const result = await buildAutoTaggingPrompt({ embedded: true });

      expect(result).toContain("you may create new relevant tags");
    });

    it("does not fetch DB tags", async () => {
      await buildAutoTaggingPrompt({ embedded: true });

      expect(listAllTagNames).not.toHaveBeenCalled();
    });
  });

  describe("recipe without description", () => {
    it("handles recipe without description in standalone mode", async () => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined");

      const recipeNoDesc = {
        title: "Simple Eggs",
        ingredients: ["eggs", "salt"],
      };

      const result = await buildAutoTaggingPrompt({ embedded: false }, recipeNoDesc);

      expect(result).toContain("Simple Eggs");
      expect(result).not.toContain("Description:");
      expect(result).toContain("- eggs");
      expect(result).toContain("- salt");
    });

    it("handles recipe with null description", async () => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined");

      const recipeNullDesc = {
        title: "Simple Eggs",
        description: null,
        ingredients: ["eggs", "salt"],
      };

      const result = await buildAutoTaggingPrompt({ embedded: false }, recipeNullDesc);

      expect(result).toContain("Simple Eggs");
      expect(result).not.toContain("Description:");
    });
  });
});
