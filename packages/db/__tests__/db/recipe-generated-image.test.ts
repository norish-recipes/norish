// @vitest-environment node
/**
 * The Generated Image replacement at the repository boundary (ADR-0025): the
 * one place a Generated Image is written. The write is deliberately
 * destructive — the row that held the primary slot is deleted, and its URL is
 * handed back so the caller can remove the file — and a mocked repository
 * cannot prove a delete deleted anything, so this runs against the real
 * database beside the dish-colour round-trip.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@norish/db/drizzle";
import { replaceRecipePrimaryImageWithGenerated } from "@norish/db/repositories/recipe-enrichment";
import { getRecipeFull } from "@norish/db/repositories/recipes";
import { recipes as recipesTable } from "@norish/db/schema";

import { createTestUser } from "../helpers/db-test-helpers";
import { createRecipeWithRefs } from "../helpers/recipe-writes";
import { RepositoryTestBase } from "../helpers/repository-test-base";

const testBase = new RepositoryTestBase("recipe_generated_image");

let userId: string;

beforeAll(async () => await testBase.setup());
afterAll(async () => await testBase.teardown());
beforeEach(async () => {
  await testBase.beforeEachTest();
  const user = await createTestUser();

  userId = user.id;
});

const BASE_RECIPE = {
  name: "Pictured Stew",
  systemUsed: "metric" as const,
  recipeIngredients: [],
  tags: [],
  cuisines: [],
  categories: [],
  steps: [],
  images: [],
  videos: [],
};

/** Plant a legacy-shaped row: scalar set the way pre-deprecation releases wrote it. */
async function plantLegacyScalar(recipeId: string, image: string): Promise<void> {
  await db.update(recipesTable).set({ image }).where(eq(recipesTable.id, recipeId));
}

function url(recipeId: string, name: string): string {
  return `/recipes/${recipeId}/${name}.jpg`;
}

async function createRecipeWithImages(
  images: { image: string; order: number; generated?: boolean }[]
): Promise<string> {
  const recipeId = crypto.randomUUID();

  await createRecipeWithRefs(recipeId, userId, { ...BASE_RECIPE, images });

  return recipeId;
}

describe("the Generated Image marker in the recipe DTO", () => {
  it("round-trips through create and reads back per image, defaulting to unmarked", async () => {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      images: [
        { image: url(recipeId, "drawn"), order: 0, generated: true },
        { image: url(recipeId, "photo"), order: 1 },
      ],
    });

    const full = await getRecipeFull(recipeId);

    expect(full?.images).toEqual([
      expect.objectContaining({ image: url(recipeId, "drawn"), generated: true }),
      expect.objectContaining({ image: url(recipeId, "photo"), generated: false }),
    ]);
  });
});

describe("replaceRecipePrimaryImageWithGenerated", () => {
  it("gives a recipe with no images exactly one, at order 0, marked", async () => {
    const recipeId = await createRecipeWithImages([]);

    const result = await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

    expect(result).toEqual({ imageUrl: url(recipeId, "drawn"), replacedImageUrls: [] });

    const images = (await getRecipeFull(recipeId))?.images;

    expect(images).toEqual([
      expect.objectContaining({ image: url(recipeId, "drawn"), order: 0, generated: true }),
    ]);
  });

  it("deletes the row that held the primary slot and keeps every other row in order", async () => {
    const recipeId = crypto.randomUUID();
    const [hero, second, third] = [url(recipeId, "hero"), url(recipeId, "b"), url(recipeId, "c")];

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      images: [
        { image: hero, order: 0 },
        { image: second, order: 1 },
        { image: third, order: 2 },
      ],
    });

    const result = await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

    expect(result?.replacedImageUrls).toEqual([hero]);

    const images = (await getRecipeFull(recipeId))?.images;

    // Ordered read: the Generated Image leads, the rest keep their contents
    // and their relative order.
    expect(images?.map((img) => img.image)).toEqual([url(recipeId, "drawn"), second, third]);
    expect(images?.map((img) => img.generated)).toEqual([true, false, false]);
  });

  it("consumes the primary slot even when the lowest stored order is not 0", async () => {
    const recipeId = crypto.randomUUID();
    const [primary, other] = [url(recipeId, "three"), url(recipeId, "seven")];

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      images: [
        { image: primary, order: 3 },
        { image: other, order: 7 },
      ],
    });

    const result = await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

    expect(result?.replacedImageUrls).toEqual([primary]);
    expect((await getRecipeFull(recipeId))?.images.map((img) => img.image)).toEqual([
      url(recipeId, "drawn"),
      other,
    ]);
  });

  it("replaces its own predecessor: a recipe never holds two Generated Images", async () => {
    const recipeId = await createRecipeWithImages([]);

    await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "first"));
    const second = await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "second"));

    expect(second?.replacedImageUrls).toEqual([url(recipeId, "first")]);

    const images = (await getRecipeFull(recipeId))?.images;

    expect(images).toEqual([
      expect.objectContaining({ image: url(recipeId, "second"), order: 0, generated: true }),
    ]);
  });

  it("sweeps a stray Generated Image that is no longer the primary", async () => {
    // Reachable only through hand reordering, but the invariant stands: at
    // most one Generated Image per recipe, whatever the gallery looks like.
    const recipeId = crypto.randomUUID();
    const [photo, stray] = [url(recipeId, "photo"), url(recipeId, "stray")];

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      images: [
        { image: photo, order: 0 },
        { image: stray, order: 1, generated: true },
      ],
    });

    const result = await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

    expect(result?.replacedImageUrls?.sort()).toEqual([photo, stray].sort());
    expect((await getRecipeFull(recipeId))?.images).toEqual([
      expect.objectContaining({ image: url(recipeId, "drawn"), order: 0, generated: true }),
    ]);
  });

  it("returns null for a recipe that does not exist", async () => {
    const missing = crypto.randomUUID();

    expect(await replaceRecipePrimaryImageWithGenerated(missing, url(missing, "drawn"))).toBeNull();
  });

  // The deprecated scalar is never written with a value; the replacement
  // clears any legacy one so a stale fallback cannot linger behind the
  // gallery, and releases its file when the recipe no longer references it.
  describe("the legacy thumbnail scalar", () => {
    it("is cleared, with the shared old file released once", async () => {
      // The URL-import-era shape: the same file once recorded in both. The
      // scalar is planted raw, the way a pre-deprecation release wrote it.
      const recipeId = crypto.randomUUID();
      const photo = url(recipeId, "photo");

      await createRecipeWithRefs(recipeId, userId, {
        ...BASE_RECIPE,
        images: [{ image: photo, order: 0 }],
      });
      await plantLegacyScalar(recipeId, photo);

      const result = await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

      expect((await getRecipeFull(recipeId))?.image).toBeNull();
      expect(result?.replacedImageUrls).toEqual([photo]);
    });

    it("is cleared on a legacy-only recipe, its photograph moved out and released", async () => {
      const recipeId = crypto.randomUUID();
      const legacy = url(recipeId, "legacy-hero");

      await createRecipeWithRefs(recipeId, userId, { ...BASE_RECIPE, images: [] });
      await plantLegacyScalar(recipeId, legacy);

      const result = await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

      const full = await getRecipeFull(recipeId);

      expect(full?.image).toBeNull();
      expect(full?.images).toEqual([
        expect.objectContaining({ image: url(recipeId, "drawn"), order: 0, generated: true }),
      ]);
      // The photograph does not survive a deliberate replacement (ADR-0025),
      // wherever it was recorded.
      expect(result?.replacedImageUrls).toEqual([legacy]);
    });

    it("stays null for a recipe that had no image anywhere", async () => {
      const recipeId = await createRecipeWithImages([]);

      await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

      expect((await getRecipeFull(recipeId))?.image).toBeNull();
    });

    it("never hands back a file a surviving gallery row still references", async () => {
      // Duplicate-content rows share a URL; displacing one copy must not
      // orphan the other's file.
      const recipeId = crypto.randomUUID();
      const shared = url(recipeId, "shared");

      await createRecipeWithRefs(recipeId, userId, {
        ...BASE_RECIPE,
        images: [
          { image: shared, order: 0 },
          { image: shared, order: 1 },
        ],
      });
      await plantLegacyScalar(recipeId, shared);

      const result = await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

      // Row at order 1 survives and still references the file.
      expect(result?.replacedImageUrls).toEqual([]);
      expect((await getRecipeFull(recipeId))?.images.map((img) => img.image)).toEqual([
        url(recipeId, "drawn"),
        shared,
      ]);
    });
  });
});

describe("getImageGenerationSweepCounts", () => {
  it("counts eligible recipes, and the subset with no image at all", async () => {
    const { getImageGenerationSweepCounts } = await import("@norish/db/repositories/recipes");

    const withIngredients = {
      ...BASE_RECIPE,
      recipeIngredients: [
        {
          ingredientName: "flour",
          ingredientId: null,
          amount: 100,
          unit: "g",
          systemUsed: "metric" as const,
          order: 0,
        },
      ],
    };

    const gapRecipe = crypto.randomUUID();
    const galleryRecipe = crypto.randomUUID();
    const legacyRecipe = crypto.randomUUID();
    const bareRecipe = crypto.randomUUID();

    await createRecipeWithRefs(gapRecipe, userId, { ...withIngredients, name: "Gap" });
    await createRecipeWithRefs(galleryRecipe, userId, {
      ...withIngredients,
      name: "Gallery",
      images: [{ image: url(galleryRecipe, "photo"), order: 0 }],
    });
    await createRecipeWithRefs(legacyRecipe, userId, {
      ...withIngredients,
      name: "Legacy",
      image: url(legacyRecipe, "hero"),
    });
    // No ingredients: insufficient input for the kind, so in neither count.
    await createRecipeWithRefs(bareRecipe, userId, { ...BASE_RECIPE, name: "Bare" });

    const counts = await getImageGenerationSweepCounts();

    // The beforeEach test recipe has no ingredients either and stays out.
    expect(counts).toEqual({ eligible: 3, missingImage: 1 });
  });
});
