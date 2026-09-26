// @vitest-environment node
/**
 * The Dish Colour round-trip at the repository boundary (ADR-0023): the
 * colour a write carries is the colour every read returns. This is the test
 * that catches an allowlist miss — getRecipeFull enumerates its columns by
 * hand, and a column that misses that list quietly reads back as null while
 * every mocked test keeps passing.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  getRecipeFull,
  listRecipesMissingDishColor,
  updateRecipeDishColor,
} from "@norish/db/repositories/recipes";

import { createTestUser } from "../helpers/db-test-helpers";
import { createRecipeWithRefs, updateRecipeWithRefs } from "../helpers/recipe-writes";
import { RepositoryTestBase } from "../helpers/repository-test-base";

const testBase = new RepositoryTestBase("recipe_dish_color");

let userId: string;

beforeAll(async () => await testBase.setup());
afterAll(async () => await testBase.teardown());
beforeEach(async () => {
  await testBase.beforeEachTest();
  const user = await createTestUser();

  userId = user.id;
});

const BASE_RECIPE = {
  name: "Coloured Stew",
  systemUsed: "metric" as const,
  recipeIngredients: [],
  tags: [],
  cuisines: [],
  categories: [],
  steps: [],
  images: [],
  videos: [],
};

describe("Dish Colour round-trip", () => {
  it("persists the colour a create carries and reads it back on the full recipe", async () => {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, { ...BASE_RECIPE, dishColor: "#a15829" });

    const full = await getRecipeFull(recipeId);

    expect(full?.dishColor).toBe("#a15829");
  });

  it("stores no colour when the create carries none", async () => {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, BASE_RECIPE);

    const full = await getRecipeFull(recipeId);

    expect(full?.dishColor).toBeNull();
  });

  it("updates and clears the colour through the update payload", async () => {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, { ...BASE_RECIPE, dishColor: "#a15829" });
    await updateRecipeWithRefs(recipeId, userId, { dishColor: null });

    expect((await getRecipeFull(recipeId))?.dishColor).toBeNull();

    await updateRecipeWithRefs(recipeId, userId, { dishColor: "#0e6b3a" });

    expect((await getRecipeFull(recipeId))?.dishColor).toBe("#0e6b3a");
  });

  it("lists colourless rows for the backfill and accepts its direct write", async () => {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      image: `/recipes/${recipeId}/hero.jpg`,
    });

    const missing = await listRecipesMissingDishColor();
    const row = missing.find((candidate) => candidate.id === recipeId);

    // The create translated the payload's legacy scalar into the gallery;
    // the backfill resolves gallery-first, exactly like every other reader.
    expect(row?.galleryImages).toEqual([
      expect.objectContaining({ image: `/recipes/${recipeId}/hero.jpg` }),
    ]);

    await updateRecipeDishColor(recipeId, "#663311");

    expect((await getRecipeFull(recipeId))?.dishColor).toBe("#663311");
    expect(
      (await listRecipesMissingDishColor()).some((candidate) => candidate.id === recipeId)
    ).toBe(false);
  });
});
