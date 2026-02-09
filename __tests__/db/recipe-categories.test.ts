// @vitest-environment node

import { describe, expect, it } from "vitest";

import { recipeCategoryEnum } from "@/server/db/schema";

const expectedCategories = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

describe("recipeCategoryEnum", () => {
  it("allows empty categories array", () => {
    expect(() => recipeCategoryEnum("categories").array().notNull().default([])).not.toThrow();
  });

  it("allows multiple categories", () => {
    expect(() => recipeCategoryEnum("categories").array()).not.toThrow();
  });

  it("exposes expected enum values", () => {
    expect(recipeCategoryEnum.enumValues).toEqual([...expectedCategories]);
  });
});
