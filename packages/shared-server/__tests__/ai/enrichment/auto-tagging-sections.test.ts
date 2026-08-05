/**
 * Auto-Tagging section builder tests.
 *
 * The administrator-editable prompt carries the tagging rules; these sections
 * — the strategy addition and the recipe under analysis — are appended after
 * it. The base prompt never appears here: the AI Runtime owns loading it.
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { listAllTagNames } from "@norish/db/repositories/tags";
import { getTagStrategy } from "@norish/shared-server/config/server-config-loader";

// Mock dependencies before imports
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getTagStrategy: vi.fn(),
}));

vi.mock("@norish/db/repositories/tags", () => ({
  listAllTagNames: vi.fn(),
}));

const { buildAutoTaggingSections } =
  await import("@norish/shared-server/ai/enrichment/auto-tagging-prompt");

describe("buildAutoTaggingSections", () => {
  const mockRecipe = {
    title: "Spaghetti Carbonara",
    description: "Classic Italian pasta dish",
    ingredients: ["spaghetti", "eggs", "pancetta", "parmesan", "black pepper"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when automatic auto-tagging is switched off", () => {
    it("still builds sections, because the strategy is not an enablement check", async () => {
      vi.mocked(getTagStrategy).mockResolvedValue("predefined");

      const sections = await buildAutoTaggingSections({}, mockRecipe);

      expect(sections.join("\n")).toContain("RECIPE TO ANALYZE");
    });
  });

  describe("predefined mode", () => {
    beforeEach(() => {
      vi.mocked(getTagStrategy).mockResolvedValue("predefined");
    });

    it("does not fetch DB tags", async () => {
      await buildAutoTaggingSections({}, mockRecipe);

      expect(listAllTagNames).not.toHaveBeenCalled();
    });

    it("appends no strategy addition, only the recipe", async () => {
      const sections = await buildAutoTaggingSections({}, mockRecipe);

      expect(sections).toHaveLength(1);
    });

    it("includes the recipe context", async () => {
      const sections = await buildAutoTaggingSections({}, mockRecipe);
      const recipeSection = sections.at(-1)!;

      expect(recipeSection).toContain("RECIPE TO ANALYZE");
      expect(recipeSection).toContain("Spaghetti Carbonara");
      expect(recipeSection).toContain("Classic Italian pasta dish");
      expect(recipeSection).toContain("- spaghetti");
      expect(recipeSection).toContain("- eggs");
      expect(recipeSection).toContain("JSON object");
    });

    it("includes ingredients list formatted as bullet points", async () => {
      const sections = await buildAutoTaggingSections({}, mockRecipe);
      const recipeSection = sections.at(-1)!;

      expect(recipeSection).toContain("- spaghetti");
      expect(recipeSection).toContain("- eggs");
      expect(recipeSection).toContain("- pancetta");
      expect(recipeSection).toContain("- parmesan");
      expect(recipeSection).toContain("- black pepper");
    });
  });

  describe("predefined_db mode", () => {
    beforeEach(() => {
      vi.mocked(getTagStrategy).mockResolvedValue("predefined_db");
    });

    it("fetches existing tags and includes them in a section", async () => {
      vi.mocked(listAllTagNames).mockResolvedValue(["dinner", "lunch", "breakfast"]);

      const sections = await buildAutoTaggingSections({}, mockRecipe);

      expect(listAllTagNames).toHaveBeenCalled();
      expect(sections.join("\n")).toContain("ADDITIONAL ALLOWED TAGS");
      expect(sections.join("\n")).toContain("dinner, lunch, breakfast");
    });

    it("uses pre-fetched tags if provided", async () => {
      const providedTags = ["custom-tag-1", "custom-tag-2"];

      const sections = await buildAutoTaggingSections({ existingDbTags: providedTags }, mockRecipe);

      expect(listAllTagNames).not.toHaveBeenCalled();
      expect(sections.join("\n")).toContain("custom-tag-1, custom-tag-2");
    });

    it("handles empty DB tags gracefully", async () => {
      vi.mocked(listAllTagNames).mockResolvedValue([]);

      const sections = await buildAutoTaggingSections({}, mockRecipe);

      expect(sections.join("\n")).not.toContain("ADDITIONAL ALLOWED TAGS");
    });
  });

  describe("freeform mode", () => {
    beforeEach(() => {
      vi.mocked(getTagStrategy).mockResolvedValue("freeform");
    });

    it("includes note about creating new tags", async () => {
      const sections = await buildAutoTaggingSections({}, mockRecipe);

      expect(sections.join("\n")).toContain("you may create new relevant tags");
    });

    it("does not fetch DB tags", async () => {
      await buildAutoTaggingSections({}, mockRecipe);

      expect(listAllTagNames).not.toHaveBeenCalled();
    });
  });

  describe("recipe without description", () => {
    it("handles recipe without description", async () => {
      vi.mocked(getTagStrategy).mockResolvedValue("predefined");

      const sections = await buildAutoTaggingSections(
        {},
        { title: "Simple Eggs", ingredients: ["eggs", "salt"] }
      );
      const recipeSection = sections.at(-1)!;

      expect(recipeSection).toContain("Simple Eggs");
      expect(recipeSection).not.toContain("Description:");
      expect(recipeSection).toContain("- eggs");
      expect(recipeSection).toContain("- salt");
    });

    it("handles recipe with null description", async () => {
      vi.mocked(getTagStrategy).mockResolvedValue("predefined");

      const sections = await buildAutoTaggingSections(
        {},
        { title: "Simple Eggs", description: null, ingredients: ["eggs", "salt"] }
      );

      expect(sections.at(-1)!).toContain("Simple Eggs");
      expect(sections.at(-1)!).not.toContain("Description:");
    });
  });
});
