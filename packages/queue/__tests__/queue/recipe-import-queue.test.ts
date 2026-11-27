/**
 * The policy-aware deduplication id of a URL import. The producer's
 * deduplication itself runs against a real Valkey in
 * ../recipe-import/producer-valkey.test.ts.
 */

// @vitest-environment node

import { describe, expect, it } from "vitest";

describe("Recipe Import Queue", () => {
  describe("recipeImportDeduplicationId", () => {
    it("generates global job ID for 'everyone' policy", async () => {
      const { recipeImportDeduplicationId } = await import("@norish/queue/helpers");

      const jobId = recipeImportDeduplicationId("https://example.com/recipe", "household-456", {
        view: "everyone",
        edit: "household",
        delete: "household",
      });

      expect(jobId).toBe("import_example.com_recipe");
      expect(jobId).not.toContain("household-456");
    }, 15_000);

    it("generates household-scoped job ID for 'household' policy", async () => {
      const { recipeImportDeduplicationId } = await import("@norish/queue/helpers");

      const jobId = recipeImportDeduplicationId("https://example.com/recipe", "household-456", {
        view: "household",
        edit: "household",
        delete: "household",
      });

      expect(jobId).toBe("import_household-456_example.com_recipe");
      expect(jobId).toContain("household-456");
    });

    it("normalizes URLs (lowercase, removes trailing slash)", async () => {
      const { recipeImportDeduplicationId } = await import("@norish/queue/helpers");

      const jobId1 = recipeImportDeduplicationId("https://Example.COM/Recipe/", "household-456", {
        view: "everyone",
        edit: "household",
        delete: "household",
      });

      const jobId2 = recipeImportDeduplicationId("https://example.com/recipe", "household-456", {
        view: "everyone",
        edit: "household",
        delete: "household",
      });

      expect(jobId1).toBe(jobId2);
    });

    it("removes tracking parameters from URLs", async () => {
      const { recipeImportDeduplicationId } = await import("@norish/queue/helpers");

      const jobId1 = recipeImportDeduplicationId(
        "https://example.com/recipe?utm_source=test&utm_medium=email",
        "household-456",
        { view: "everyone", edit: "household", delete: "household" }
      );

      const jobId2 = recipeImportDeduplicationId("https://example.com/recipe", "household-456", {
        view: "everyone",
        edit: "household",
        delete: "household",
      });

      expect(jobId1).toBe(jobId2);
    });
  });
});
