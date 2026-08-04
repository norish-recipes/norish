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
import { listAllTagNames } from "@norish/db/repositories/tags";
import { loadPrompt } from "@norish/shared-server/ai/prompts/loader";
import { getTagStrategy } from "@norish/shared-server/config/server-config-loader";

// Mock dependencies before imports
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getTagStrategy: vi.fn(),
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

  describe("when automatic auto-tagging is switched off", () => {
    it("still builds a prompt, because the strategy is not an enablement check", async () => {
      vi.mocked(getTagStrategy).mockResolvedValue("predefined");

      const result = await buildAutoTaggingPrompt({}, mockRecipe);

      expect(result).toContain("PREDEFINED TAGS:");
      expect(loadPrompt).toHaveBeenCalledWith("auto-tagging");
    });
  });

  describe("predefined mode", () => {
    beforeEach(() => {
      vi.mocked(getTagStrategy).mockResolvedValue("predefined");
    });

    it("does not fetch DB tags", async () => {
      await buildAutoTaggingPrompt({}, mockRecipe);

      expect(listAllTagNames).not.toHaveBeenCalled();
    });

    it("returns the prompt with recipe context", async () => {
      const result = await buildAutoTaggingPrompt({}, mockRecipe);

      expect(result).toContain(mockBasePrompt);
      expect(result).toContain("RECIPE TO ANALYZE");
      expect(result).toContain("Spaghetti Carbonara");
      expect(result).toContain("Classic Italian pasta dish");
      expect(result).toContain("- spaghetti");
      expect(result).toContain("- eggs");
      expect(result).toContain("JSON object");
    });

    it("includes ingredients list formatted as bullet points", async () => {
      const result = await buildAutoTaggingPrompt({}, mockRecipe);

      expect(result).toContain("- spaghetti");
      expect(result).toContain("- eggs");
      expect(result).toContain("- pancetta");
      expect(result).toContain("- parmesan");
      expect(result).toContain("- black pepper");
    });
  });

  describe("predefined_db mode", () => {
    beforeEach(() => {
      vi.mocked(getTagStrategy).mockResolvedValue("predefined_db");
    });

    it("fetches existing tags and includes them in the prompt", async () => {
      vi.mocked(listAllTagNames).mockResolvedValue(["dinner", "lunch", "breakfast"]);

      const result = await buildAutoTaggingPrompt({}, mockRecipe);

      expect(listAllTagNames).toHaveBeenCalled();
      expect(result).toContain("ADDITIONAL ALLOWED TAGS");
      expect(result).toContain("dinner, lunch, breakfast");
    });

    it("uses pre-fetched tags if provided", async () => {
      const providedTags = ["custom-tag-1", "custom-tag-2"];

      const result = await buildAutoTaggingPrompt({ existingDbTags: providedTags }, mockRecipe);

      expect(listAllTagNames).not.toHaveBeenCalled();
      expect(result).toContain("custom-tag-1, custom-tag-2");
    });

    it("handles empty DB tags gracefully", async () => {
      vi.mocked(listAllTagNames).mockResolvedValue([]);

      const result = await buildAutoTaggingPrompt({}, mockRecipe);

      expect(result).not.toContain("ADDITIONAL ALLOWED TAGS");
    });
  });

  describe("freeform mode", () => {
    beforeEach(() => {
      vi.mocked(getTagStrategy).mockResolvedValue("freeform");
    });

    it("includes note about creating new tags", async () => {
      const result = await buildAutoTaggingPrompt({}, mockRecipe);

      expect(result).toContain("you may create new relevant tags");
    });

    it("does not fetch DB tags", async () => {
      await buildAutoTaggingPrompt({}, mockRecipe);

      expect(listAllTagNames).not.toHaveBeenCalled();
    });
  });

  describe("recipe without description", () => {
    it("handles recipe without description", async () => {
      vi.mocked(getTagStrategy).mockResolvedValue("predefined");

      const recipeNoDesc = {
        title: "Simple Eggs",
        ingredients: ["eggs", "salt"],
      };

      const result = await buildAutoTaggingPrompt({}, recipeNoDesc);

      expect(result).toContain("Simple Eggs");
      expect(result).not.toContain("Description:");
      expect(result).toContain("- eggs");
      expect(result).toContain("- salt");
    });

    it("handles recipe with null description", async () => {
      vi.mocked(getTagStrategy).mockResolvedValue("predefined");

      const recipeNullDesc = {
        title: "Simple Eggs",
        description: null,
        ingredients: ["eggs", "salt"],
      };

      const result = await buildAutoTaggingPrompt({}, recipeNullDesc);

      expect(result).toContain("Simple Eggs");
      expect(result).not.toContain("Description:");
    });
  });
});
