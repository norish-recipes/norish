// @vitest-environment node
/**
 * Every list-shaped projection resolves its thumbnail from the gallery,
 * with the legacy `recipes.image` scalar only as a fallback — the SQL twin
 * of `primaryRecipeImage`. This is what lets the scalar column head toward
 * removal: a gallery-only recipe must show a picture everywhere without it.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@norish/db/drizzle";
import {
  createPlannedItem,
  getPlannedItemWithRecipeById,
  listPlannedItemsByUserAndDateRange,
  listPlannedItemsWithRecipeBySlot,
} from "@norish/db/repositories/planned-items";
import {
  createRecipeWithRefs,
  dashboardRecipe,
  getRandomRecipeCandidates,
  getRecipeFull,
  listRecipes,
  searchRecipesByName,
  updateRecipeWithRefs,
} from "@norish/db/repositories/recipes";
import { recipes as recipesTable } from "@norish/db/schema";

import { createTestUser } from "../helpers/db-test-helpers";
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

async function seedThreeShapes() {
  const galleryOnly = crypto.randomUUID();
  const legacyOnly = crypto.randomUUID();
  const both = crypto.randomUUID();

  await createRecipeWithRefs(galleryOnly, userId, {
    ...BASE_RECIPE,
    name: "Gallery Only",
    images: [
      { image: `/recipes/${galleryOnly}/second.jpg`, order: 1 },
      { image: `/recipes/${galleryOnly}/first.jpg`, order: 0 },
    ],
  });
  await createRecipeWithRefs(legacyOnly, userId, {
    ...BASE_RECIPE,
    name: "Legacy Only",
    image: `/recipes/${legacyOnly}/legacy.jpg`,
  });
  await createRecipeWithRefs(both, userId, {
    ...BASE_RECIPE,
    name: "Both Stored",
    image: `/recipes/${both}/stale-scalar.jpg`,
    images: [{ image: `/recipes/${both}/gallery.jpg`, order: 0 }],
  });

  return { galleryOnly, legacyOnly, both };
}

describe("thumbnail resolution across the list projections", () => {
  it("listRecipes leads with the gallery and falls back to the scalar", async () => {
    await seedThreeShapes();

    const { recipes } = await listRecipes(listContext(), 50);
    const byName = new Map(recipes.map((recipe) => [recipe.name, recipe.image]));

    expect(byName.get("Gallery Only")).toMatch(/\/first\.jpg$/);
    expect(byName.get("Legacy Only")).toMatch(/\/legacy\.jpg$/);
    // A stale scalar never outranks the gallery.
    expect(byName.get("Both Stored")).toMatch(/\/gallery\.jpg$/);
  });

  it("dashboardRecipe resolves the same way", async () => {
    const { galleryOnly, both } = await seedThreeShapes();

    expect((await dashboardRecipe(galleryOnly))?.image).toMatch(/\/first\.jpg$/);
    expect((await dashboardRecipe(both))?.image).toMatch(/\/gallery\.jpg$/);
  });

  it("autocomplete search resolves the same way", async () => {
    await seedThreeShapes();

    const results = await searchRecipesByName(listContext(), "Gallery Only", 5);

    expect(results[0]?.image).toMatch(/\/first\.jpg$/);
  });

  it("random-recipe candidates resolve the same way", async () => {
    const { galleryOnly, legacyOnly } = await seedThreeShapes();

    const candidates = await getRandomRecipeCandidates(listContext());
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate.image]));

    expect(byId.get(galleryOnly)).toMatch(/\/first\.jpg$/);
    expect(byId.get(legacyOnly)).toMatch(/\/legacy\.jpg$/);
  });
});

describe("planned items resolve their recipe thumbnail the same way", () => {
  // A planned recipe joins the recipe for its picture (issue #581): a recipe
  // whose only image lives in the gallery must still show it on the calendar.
  async function planAll() {
    const shapes = await seedThreeShapes();
    const date = "2026-03-02";
    const planned = {
      galleryOnly: await createPlannedItem({
        userId,
        date,
        slot: "Dinner",
        itemType: "recipe",
        recipeId: shapes.galleryOnly,
      }),
      legacyOnly: await createPlannedItem({
        userId,
        date,
        slot: "Dinner",
        itemType: "recipe",
        recipeId: shapes.legacyOnly,
      }),
      both: await createPlannedItem({
        userId,
        date,
        slot: "Lunch",
        itemType: "recipe",
        recipeId: shapes.both,
      }),
    };

    return { shapes, planned, date };
  }

  it("listPlannedItemsByUserAndDateRange leads with the gallery and falls back to the scalar", async () => {
    const { shapes, date } = await planAll();

    const items = await listPlannedItemsByUserAndDateRange([userId], date, date);
    const byRecipe = new Map(items.map((item) => [item.recipeId, item.recipeImage]));

    expect(byRecipe.get(shapes.galleryOnly)).toMatch(/\/first\.jpg$/);
    expect(byRecipe.get(shapes.legacyOnly)).toMatch(/\/legacy\.jpg$/);
    expect(byRecipe.get(shapes.both)).toMatch(/\/gallery\.jpg$/);
  });

  it("getPlannedItemWithRecipeById resolves the same way", async () => {
    const { planned } = await planAll();

    expect((await getPlannedItemWithRecipeById(planned.galleryOnly.id))?.recipeImage).toMatch(
      /\/first\.jpg$/
    );
    expect((await getPlannedItemWithRecipeById(planned.both.id))?.recipeImage).toMatch(
      /\/gallery\.jpg$/
    );
  });

  it("listPlannedItemsWithRecipeBySlot resolves the same way", async () => {
    const { shapes, date } = await planAll();

    const items = await listPlannedItemsWithRecipeBySlot([userId], date, "Dinner");
    const byRecipe = new Map(items.map((item) => [item.recipeId, item.recipeImage]));

    expect(byRecipe.get(shapes.galleryOnly)).toMatch(/\/first\.jpg$/);
    expect(byRecipe.get(shapes.legacyOnly)).toMatch(/\/legacy\.jpg$/);
  });
});

/** The raw column, bypassing every resolving reader. */
async function rawScalar(recipeId: string): Promise<string | null> {
  const [row] = await db
    .select({ image: recipesTable.image })
    .from(recipesTable)
    .where(eq(recipesTable.id, recipeId));

  return row?.image ?? null;
}

/** Plant a legacy-shaped row: scalar set the way pre-gallery releases wrote it. */
async function plantLegacyScalar(recipeId: string, url: string): Promise<void> {
  await db.update(recipesTable).set({ image: url }).where(eq(recipesTable.id, recipeId));
}

describe("the write side retires the scalar", () => {
  it("translates a scalar-only create into a gallery row and writes no scalar", async () => {
    // The shape every foreign archive import produces.
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      name: "Scalar Only Create",
      image: `/recipes/${recipeId}/hero.jpg`,
    });

    expect(await rawScalar(recipeId)).toBeNull();
    expect((await getRecipeFull(recipeId))?.images).toEqual([
      expect.objectContaining({ image: `/recipes/${recipeId}/hero.jpg`, generated: false }),
    ]);
    expect((await dashboardRecipe(recipeId))?.image).toMatch(/\/hero\.jpg$/);
  });

  it("does not duplicate a scalar the gallery already carries", async () => {
    // The URL-import shape: the best image recorded in both places.
    const recipeId = crypto.randomUUID();
    const shared = `/recipes/${recipeId}/best.jpg`;

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      name: "Deduplicated Create",
      image: shared,
      images: [
        { image: shared, order: 0 },
        { image: `/recipes/${recipeId}/extra.jpg`, order: 1 },
      ],
    });

    expect(await rawScalar(recipeId)).toBeNull();
    expect((await getRecipeFull(recipeId))?.images.map((img) => img.image)).toEqual([
      shared,
      `/recipes/${recipeId}/extra.jpg`,
    ]);
  });

  it("keeps a stray scalar by appending it after the gallery, never as the new primary", async () => {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      name: "Stray Scalar Create",
      image: `/recipes/${recipeId}/stray.jpg`,
      images: [{ image: `/recipes/${recipeId}/primary.jpg`, order: 0 }],
    });

    expect(await rawScalar(recipeId)).toBeNull();
    expect((await getRecipeFull(recipeId))?.images.map((img) => img.image)).toEqual([
      `/recipes/${recipeId}/primary.jpg`,
      `/recipes/${recipeId}/stray.jpg`,
    ]);
  });

  it("clears a legacy scalar when an update replaces the gallery", async () => {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, { ...BASE_RECIPE, name: "Gallery Update" });
    await plantLegacyScalar(recipeId, `/recipes/${recipeId}/legacy.jpg`);

    await updateRecipeWithRefs(recipeId, userId, {
      images: [{ image: `/recipes/${recipeId}/uploaded.jpg`, order: 0 }],
    });

    // A stale fallback must not linger behind the gallery: deleting the
    // gallery later would resurrect an image the editor replaced.
    expect(await rawScalar(recipeId)).toBeNull();
    expect((await dashboardRecipe(recipeId))?.image).toMatch(/\/uploaded\.jpg$/);
  });

  it("translates a scalar-only update into the gallery when the gallery is empty", async () => {
    // The public API's legacy alias: PATCH { image } still lands somewhere
    // every reader sees.
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, { ...BASE_RECIPE, name: "Scalar Update" });

    await updateRecipeWithRefs(recipeId, userId, { image: `/recipes/${recipeId}/patched.jpg` });

    expect(await rawScalar(recipeId)).toBeNull();
    expect((await getRecipeFull(recipeId))?.images).toEqual([
      expect.objectContaining({ image: `/recipes/${recipeId}/patched.jpg` }),
    ]);
  });

  it("ignores a scalar-only update when a gallery exists, clearing the column", async () => {
    // With a gallery present the scalar was never rendered anywhere; writing
    // it would only park a value no reader consults.
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      name: "Shadowed Scalar Update",
      images: [{ image: `/recipes/${recipeId}/primary.jpg`, order: 0 }],
    });

    await updateRecipeWithRefs(recipeId, userId, { image: `/recipes/${recipeId}/shadowed.jpg` });

    expect(await rawScalar(recipeId)).toBeNull();
    expect((await getRecipeFull(recipeId))?.images.map((img) => img.image)).toEqual([
      `/recipes/${recipeId}/primary.jpg`,
    ]);
  });

  it("lands the hero in the gallery when an update empties it alongside a scalar", async () => {
    // The overwrite-import shape for a gallery-less archive: images: [] and
    // the rehomed hero travelling as the scalar. The hero must survive.
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      name: "Overwrite Import",
      images: [{ image: `/recipes/${recipeId}/old.jpg`, order: 0 }],
    });

    await updateRecipeWithRefs(recipeId, userId, {
      image: `/recipes/${recipeId}/hero.jpg`,
      images: [],
    });

    expect(await rawScalar(recipeId)).toBeNull();
    expect((await getRecipeFull(recipeId))?.images).toEqual([
      expect.objectContaining({ image: `/recipes/${recipeId}/hero.jpg` }),
    ]);
  });

  it("still honours an explicit clear of the legacy scalar", async () => {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, { ...BASE_RECIPE, name: "Cleared Scalar" });
    await plantLegacyScalar(recipeId, `/recipes/${recipeId}/legacy.jpg`);

    await updateRecipeWithRefs(recipeId, userId, { image: null });

    expect(await rawScalar(recipeId)).toBeNull();
  });

  it("preserves a legacy scalar across updates that do not touch media", async () => {
    // Migration territory, not write territory: a rename must not strip an
    // untouched legacy row of its only image.
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, { ...BASE_RECIPE, name: "Untouched Legacy" });
    await plantLegacyScalar(recipeId, `/recipes/${recipeId}/legacy.jpg`);

    await updateRecipeWithRefs(recipeId, userId, { name: "Untouched Legacy Renamed" });

    expect(await rawScalar(recipeId)).toBe(`/recipes/${recipeId}/legacy.jpg`);
    expect((await dashboardRecipe(recipeId))?.image).toMatch(/\/legacy\.jpg$/);
  });
});
