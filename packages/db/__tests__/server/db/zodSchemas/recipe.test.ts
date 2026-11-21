// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  FullRecipeInsertSchema,
  FullRecipeSchema,
  recipeCategorySchema,
  RecipeDashboardSchema,
} from "@norish/shared/contracts/zod/recipe";

describe("recipeCategorySchema", () => {
  it("accepts any name, trimmed with its inner whitespace collapsed", () => {
    expect(recipeCategorySchema.parse("Breakfast")).toBe("Breakfast");
    expect(recipeCategorySchema.parse("  Side   dishes ")).toBe("Side dishes");
  });

  it("rejects a blank name and one longer than 40 characters", () => {
    expect(() => recipeCategorySchema.parse("   ")).toThrow();
    expect(() => recipeCategorySchema.parse("x".repeat(41))).toThrow();
    expect(() => recipeCategorySchema.parse("x".repeat(40))).not.toThrow();
  });
});

describe("recipe schemas", () => {
  it("parses categories on dashboard schema", () => {
    const parsed = RecipeDashboardSchema.pick({ categories: true }).parse({});

    expect(parsed.categories).toEqual([]);
  });

  it("parses categories on full recipe schema", () => {
    const parsed = FullRecipeSchema.pick({ categories: true }).parse({
      categories: ["Breakfast"],
    });

    expect(parsed.categories).toEqual(["Breakfast"]);
  });

  it("parses categories on full recipe insert schema", () => {
    const parsed = FullRecipeInsertSchema.pick({ categories: true }).parse({});

    expect(parsed.categories).toEqual([]);
  });
});
