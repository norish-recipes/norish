// @vitest-environment node

import { describe, expect, it } from "vitest";

import { ListEntryNameSchemas } from "@norish/shared/contracts/zod/list-entry";
import {
  FullRecipeInsertSchema,
  FullRecipeSchema,
  FullRecipeUpdateSchema,
  recipeCategorySchema,
  RecipeDashboardSchema,
  RecipeListInputSchema,
} from "@norish/shared/contracts/zod/recipe";

describe("recipeCategorySchema", () => {
  it("accepts any name, trimmed with its inner whitespace collapsed", () => {
    expect(recipeCategorySchema.parse("Breakfast")).toBe("Breakfast");
    expect(recipeCategorySchema.parse("  Side   dishes ")).toBe("Side dishes");
  });

  it("rejects a blank name but takes a stored one of any length", () => {
    expect(() => recipeCategorySchema.parse("   ")).toThrow();
    expect(recipeCategorySchema.parse("x".repeat(60))).toBe("x".repeat(60));
  });

  it("bounds a Category only where the list creates or renames one", () => {
    expect(() => ListEntryNameSchemas.category.parse("x".repeat(41))).toThrow();
    expect(() => ListEntryNameSchemas.category.parse("x".repeat(40))).not.toThrow();
  });
});

describe("a stored Category over the bound", () => {
  const long = "x".repeat(60);

  it("filters and saves", () => {
    expect(RecipeListInputSchema.parse({ categories: [long] }).categories).toEqual([long]);
    expect(FullRecipeInsertSchema.pick({ categories: true }).parse({ categories: [long] })).toEqual(
      { categories: [long] }
    );
    expect(FullRecipeUpdateSchema.pick({ categories: true }).parse({ categories: [long] })).toEqual(
      { categories: [long] }
    );
  });
});

describe("recipe schemas", () => {
  it("reads a stored Category of any length, so an older one stays readable", () => {
    const long = "x".repeat(60);

    expect(FullRecipeSchema.pick({ categories: true }).parse({ categories: [long] })).toEqual({
      categories: [long],
    });
    expect(RecipeDashboardSchema.pick({ categories: true }).parse({ categories: [long] })).toEqual({
      categories: [long],
    });
  });

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

  it("takes a client-made recipe id in any letter case as the database spells it", () => {
    const id = "123E4567-E89B-12D3-A456-426614174000";

    expect(FullRecipeInsertSchema.pick({ id: true }).parse({ id }).id).toBe(id.toLowerCase());
  });
});
