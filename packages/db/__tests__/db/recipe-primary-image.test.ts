// @vitest-environment node
/**
 * Every list-shaped projection resolves its thumbnail from the gallery: the
 * first image by order, the SQL twin of `primaryRecipeImage`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createPlannedItem,
  getPlannedItemWithRecipeById,
  listPlannedItemsByUserAndDateRange,
  listPlannedItemsWithRecipeBySlot,
} from "@norish/db/repositories/planned-items";
import {
  dashboardRecipe,
  getRandomRecipeCandidates,
  listRecipes,
  searchRecipesByName,
} from "@norish/db/repositories/recipes";

import { createTestUser } from "../helpers/db-test-helpers";
import { createRecipeWithRefs } from "../helpers/recipe-writes";
import { RepositoryTestBase } from "../helpers/repository-test-base";

const testBase = new RepositoryTestBase("recipe_primary_image");

let userId: string;

beforeAll(async () => await testBase.setup());
afterAll(async () => await testBase.teardown());
beforeEach(async () => {
  await testBase.beforeEachTest();
  const user = await createTestUser();

  userId = user.id;
});

const BASE_RECIPE = {
  systemUsed: "metric" as const,
  recipeIngredients: [],
  tags: [],
  cuisines: [],
  categories: [],
  steps: [],
  images: [],
  videos: [],
};

function listContext() {
  return { userId, householdUserIds: [userId], isServerAdmin: false };
}

async function seedShapes() {
  const galleryOnly = crypto.randomUUID();
  const noImage = crypto.randomUUID();

  await createRecipeWithRefs(galleryOnly, userId, {
    ...BASE_RECIPE,
    name: "Gallery Only",
    images: [
      { image: `/recipes/${galleryOnly}/second.jpg`, order: 1 },
      { image: `/recipes/${galleryOnly}/first.jpg`, order: 0 },
    ],
  });
  await createRecipeWithRefs(noImage, userId, { ...BASE_RECIPE, name: "No Image" });

  return { galleryOnly, noImage };
}

describe("thumbnail resolution across the list projections", () => {
  it("listRecipes leads with the first gallery image", async () => {
    await seedShapes();

    const { recipes } = await listRecipes(listContext(), 50);
    const byName = new Map(recipes.map((recipe) => [recipe.name, recipe.image]));

    expect(byName.get("Gallery Only")).toMatch(/\/first\.jpg$/);
    expect(byName.get("No Image")).toBeNull();
  });

  it("dashboardRecipe resolves the same way", async () => {
    const { galleryOnly, noImage } = await seedShapes();

    expect((await dashboardRecipe(galleryOnly))?.image).toMatch(/\/first\.jpg$/);
    expect((await dashboardRecipe(noImage))?.image).toBeNull();
  });

  it("autocomplete search resolves the same way", async () => {
    await seedShapes();

    const results = await searchRecipesByName(listContext(), "Gallery Only", 5);

    expect(results[0]?.image).toMatch(/\/first\.jpg$/);
  });

  it("random-recipe candidates resolve the same way", async () => {
    const { galleryOnly, noImage } = await seedShapes();

    const candidates = await getRandomRecipeCandidates(listContext());
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate.image]));

    expect(byId.get(galleryOnly)).toMatch(/\/first\.jpg$/);
    expect(byId.get(noImage)).toBeNull();
  });
});

describe("planned items resolve their recipe thumbnail the same way", () => {
  // A planned recipe joins the recipe for its picture (issue #581): a recipe
  // whose only image lives in the gallery must still show it on the calendar.
  async function planAll() {
    const shapes = await seedShapes();
    const date = "2026-03-02";
    const planned = {
      galleryOnly: await createPlannedItem({
        userId,
        date,
        slot: "Dinner",
        itemType: "recipe",
        recipeId: shapes.galleryOnly,
      }),
      noImage: await createPlannedItem({
        userId,
        date,
        slot: "Lunch",
        itemType: "recipe",
        recipeId: shapes.noImage,
      }),
    };

    return { shapes, planned, date };
  }

  it("listPlannedItemsByUserAndDateRange leads with the first gallery image", async () => {
    const { shapes, date } = await planAll();

    const items = await listPlannedItemsByUserAndDateRange([userId], date, date);
    const byRecipe = new Map(items.map((item) => [item.recipeId, item.recipeImage]));

    expect(byRecipe.get(shapes.galleryOnly)).toMatch(/\/first\.jpg$/);
    expect(byRecipe.get(shapes.noImage)).toBeNull();
  });

  it("getPlannedItemWithRecipeById resolves the same way", async () => {
    const { planned } = await planAll();

    expect((await getPlannedItemWithRecipeById(planned.galleryOnly.id))?.recipeImage).toMatch(
      /\/first\.jpg$/
    );
    expect((await getPlannedItemWithRecipeById(planned.noImage.id))?.recipeImage).toBeNull();
  });

  it("listPlannedItemsWithRecipeBySlot resolves the same way", async () => {
    const { shapes, date } = await planAll();

    const items = await listPlannedItemsWithRecipeBySlot([userId], date, "Dinner");
    const byRecipe = new Map(items.map((item) => [item.recipeId, item.recipeImage]));

    expect(byRecipe.get(shapes.galleryOnly)).toMatch(/\/first\.jpg$/);
  });
});
