// @vitest-environment node

import { describe, expect, it } from "vitest";

import { RecipeImportInputSchema } from "@norish/shared/contracts/zod";

describe("RecipeImportInputSchema", () => {
  it("fills in https:// for a link typed without a scheme", () => {
    expect(RecipeImportInputSchema.parse({ url: " www.example.com/recipes/udon " }).url).toBe(
      "https://www.example.com/recipes/udon"
    );
  });

  it("keeps a link that already has a scheme", () => {
    expect(RecipeImportInputSchema.parse({ url: "http://example.com/a" }).url).toBe(
      "http://example.com/a"
    );
  });

  it("still refuses what is not a page", () => {
    expect(RecipeImportInputSchema.safeParse({ url: "not a link" }).success).toBe(false);
    expect(RecipeImportInputSchema.safeParse({ url: "" }).success).toBe(false);
  });
});
