import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildFullRecipe } from "./norish-fixtures";

// @vitest-environment node

const mockListVisibleRecipeIds = vi.fn();
const mockGetRecipeFull = vi.fn();
const mockGetUserRatingsByRecipeIds = vi.fn();
const mockGetFavoritesByRecipeIds = vi.fn();

vi.mock("@norish/db/repositories/recipes", () => ({
  listVisibleRecipeIds: mockListVisibleRecipeIds,
  getRecipeFull: mockGetRecipeFull,
}));

vi.mock("@norish/db/repositories/ratings", () => ({
  getUserRatingsByRecipeIds: mockGetUserRatingsByRecipeIds,
}));

vi.mock("@norish/db/repositories/favorites", () => ({
  getFavoritesByRecipeIds: mockGetFavoritesByRecipeIds,
}));

const RECIPE_A = "11111111-1111-4111-8111-111111111111";
const RECIPE_B = "99999999-9999-4999-8999-999999999999";

describe("norish export service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockListVisibleRecipeIds.mockResolvedValue([RECIPE_A, RECIPE_B]);
    mockGetRecipeFull.mockImplementation(async (id: string) =>
      buildFullRecipe({ id, name: `Recipe ${id.slice(0, 8)}` })
    );
    mockGetUserRatingsByRecipeIds.mockResolvedValue(new Map());
    mockGetFavoritesByRecipeIds.mockResolvedValue(new Set());
  });

  it("delegates scope to the recipe listing visibility layer", async () => {
    const { buildNorishArchiveForViewer } = await import(
      "@norish/shared-server/archive/norish-export"
    );

    const ctx = { userId: "user-1", householdUserIds: ["user-1", "user-2"], isServerAdmin: false };

    await buildNorishArchiveForViewer({
      ctx,
      exporter: { name: "Mika", origin: "https://norish.example.com" },
      exportedAt: new Date("2026-08-15T12:00:00Z"),
    });

    expect(mockListVisibleRecipeIds).toHaveBeenCalledTimes(1);
    expect(mockListVisibleRecipeIds).toHaveBeenCalledWith(ctx);
  });

  it("writes one folder per visible recipe and fills the exporter block", async () => {
    const { buildNorishArchiveForViewer } = await import(
      "@norish/shared-server/archive/norish-export"
    );

    const { zip, recipeCount } = await buildNorishArchiveForViewer({
      ctx: { userId: "user-1", householdUserIds: null, isServerAdmin: false },
      exporter: { name: "Mika", origin: "https://norish.example.com" },
      exportedAt: new Date("2026-08-15T12:00:00Z"),
    });

    expect(recipeCount).toBe(2);
    expect(zip.file(`${RECIPE_A}/recipe.json`)).toBeTruthy();
    expect(zip.file(`${RECIPE_B}/recipe.json`)).toBeTruthy();

    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));

    expect(manifest).toMatchObject({
      format: "norish-recipes",
      formatVersion: 1,
      exportedAt: "2026-08-15T12:00:00.000Z",
      exporter: { name: "Mika", origin: "https://norish.example.com" },
      recipeCount: 2,
    });
  });

  it("exports only the exporting user's own marks", async () => {
    mockGetUserRatingsByRecipeIds.mockResolvedValue(new Map([[RECIPE_A, 5]]));
    mockGetFavoritesByRecipeIds.mockResolvedValue(new Set([RECIPE_B]));

    const { buildNorishArchiveForViewer } = await import(
      "@norish/shared-server/archive/norish-export"
    );

    const { zip } = await buildNorishArchiveForViewer({
      ctx: { userId: "user-1", householdUserIds: null, isServerAdmin: false },
      exporter: { name: "Mika", origin: "https://norish.example.com" },
      exportedAt: new Date("2026-08-15T12:00:00Z"),
    });

    // The marks are read for the exporting user, never for the household
    expect(mockGetUserRatingsByRecipeIds).toHaveBeenCalledWith("user-1", [RECIPE_A, RECIPE_B]);
    expect(mockGetFavoritesByRecipeIds).toHaveBeenCalledWith("user-1", [RECIPE_A, RECIPE_B]);

    const recipeA = JSON.parse(await zip.file(`${RECIPE_A}/recipe.json`)!.async("string"));
    const recipeB = JSON.parse(await zip.file(`${RECIPE_B}/recipe.json`)!.async("string"));

    expect(recipeA.rating).toBe(5);
    expect(recipeA).not.toHaveProperty("favorite");
    expect(recipeB).not.toHaveProperty("rating");
    expect(recipeB.favorite).toBe(true);
  });

  it("drops a recipe deleted between listing and loading", async () => {
    mockGetRecipeFull.mockImplementation(async (id: string) =>
      id === RECIPE_B ? null : buildFullRecipe({ id })
    );

    const { buildNorishArchiveForViewer } = await import(
      "@norish/shared-server/archive/norish-export"
    );

    const { zip, recipeCount } = await buildNorishArchiveForViewer({
      ctx: { userId: "user-1", householdUserIds: null, isServerAdmin: false },
      exporter: { name: "Mika", origin: "https://norish.example.com" },
      exportedAt: new Date("2026-08-15T12:00:00Z"),
    });

    expect(recipeCount).toBe(1);
    expect(zip.file(`${RECIPE_A}/recipe.json`)).toBeTruthy();
    expect(zip.file(`${RECIPE_B}/recipe.json`)).toBeNull();

    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));

    expect(manifest.recipeCount).toBe(1);
  });

  it("keeps exporting when a single recipe fails to load", async () => {
    mockGetRecipeFull.mockImplementation(async (id: string) => {
      if (id === RECIPE_A) throw new Error("row vanished mid-query");

      return buildFullRecipe({ id });
    });

    const { buildNorishArchiveForViewer } = await import(
      "@norish/shared-server/archive/norish-export"
    );

    const { recipeCount } = await buildNorishArchiveForViewer({
      ctx: { userId: "user-1", householdUserIds: null, isServerAdmin: false },
      exporter: { name: "Mika", origin: "https://norish.example.com" },
      exportedAt: new Date("2026-08-15T12:00:00Z"),
    });

    expect(recipeCount).toBe(1);
  });
});
