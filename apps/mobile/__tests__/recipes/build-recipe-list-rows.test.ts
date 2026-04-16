import { describe, expect, it } from "vitest";

import { buildRecipeListRows } from "../../src/lib/recipes/build-recipe-list-rows";

describe("buildRecipeListRows", () => {
  it("renders initial skeleton rows before first payload", () => {
    const rows = buildRecipeListRows({
      recipes: [],
      isLoading: true,
      isValidating: false,
      pendingCount: 0,
      recipePrefix: "recipe",
      initialSkeletonPrefix: "initial",
      pendingImportPrefix: "pending-import",
    });

    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.type === "initial-skeleton")).toBe(true);
  });

  it("prepends pending import placeholders before recipe rows", () => {
    const rows = buildRecipeListRows({
      recipes: [
        {
          id: "recipe-1",
          version: 1,
          ownerId: "owner-1",
          imageUrl: "",
          title: "Recipe",
          description: "",
          servings: 2,
          rating: 4,
          tags: [],
          categories: [],
          course: "",
          liked: false,
          totalDurationMinutes: 10,
        },
      ],
      isLoading: false,
      isValidating: false,
      pendingCount: 2,
      recipePrefix: "recipe",
      initialSkeletonPrefix: "initial",
      pendingImportPrefix: "pending-import",
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]?.type).toBe("pending-import");
    expect(rows[1]?.type).toBe("pending-import");
    expect(rows[2]?.type).toBe("recipe");
  });

  it("shows initial skeleton rows when validating with empty recipes", () => {
    const rows = buildRecipeListRows({
      recipes: [],
      isLoading: false,
      isValidating: true,
      pendingCount: 0,
      recipePrefix: "recipe",
      initialSkeletonPrefix: "initial",
      pendingImportPrefix: "pending-import",
    });

    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.type === "initial-skeleton")).toBe(true);
  });
});
