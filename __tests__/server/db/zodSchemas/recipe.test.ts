// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  FullRecipeInsertSchema,
  FullRecipeSchema,
  RecipeDashboardSchema,
  recipeCategorySchema,
} from "@/server/db/zodSchemas/recipe";

describe("recipeCategorySchema", () => {
  it("accepts valid category values", () => {
    expect(() => recipeCategorySchema.parse("Breakfast")).not.toThrow();
    expect(() => recipeCategorySchema.parse("Dinner")).not.toThrow();
  });

  it("rejects invalid category values", () => {
    expect(() => recipeCategorySchema.parse("InvalidCategory")).toThrow();
  });
});

describe("recipe category arrays", () => {
  it("accepts valid categories arrays", () => {
    const categories = ["Lunch", "Dinner"];

    expect(() => recipeCategorySchema.array().parse(categories)).not.toThrow();
  });

  it("rejects invalid categories arrays", () => {
    const categories = ["InvalidCategory"];

    expect(() => recipeCategorySchema.array().parse(categories)).toThrow();
  });

  it("accepts empty array with default", () => {
    expect(() => recipeCategorySchema.array().default([]).parse(undefined)).not.toThrow();
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
