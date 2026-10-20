// @vitest-environment node
/**
 * The Generated Image replacement at the repository boundary (ADR-0025,
 * ADR-0040): the one place a Generated Image is written. The write takes the
 * primary slot, replaces a previous Generated Image, and keeps every Source
 * Image — the row and the file — and a mocked repository cannot prove a
 * delete deleted anything, so this runs against the real database beside the
 * dish-colour round-trip.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@norish/db/drizzle";
import { replaceRecipePrimaryImageWithGenerated } from "@norish/db/repositories/recipe-enrichment";
import {
  addGalleryImageWithinCap,
  dashboardRecipe,
  getRecipeFull,
} from "@norish/db/repositories/recipes";
import { recipes as recipesTable } from "@norish/db/schema";

import { createTestUser } from "../helpers/db-test-helpers";
import { createRecipeWithRefs, updateRecipeWithRefs } from "../helpers/recipe-writes";
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

  it("keeps the Source Image that held the primary slot, behind the new image", async () => {
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

    // A photograph is never released by Image Generation (ADR-0040).
    expect(result?.replacedImageUrls).toEqual([]);

    const images = (await getRecipeFull(recipeId))?.images;

    // Ordered read: the Generated Image leads, the Source Images keep their
    // contents and their relative order behind it.
    expect(images?.map((img) => img.image)).toEqual([url(recipeId, "drawn"), hero, second, third]);
    expect(images?.map((img) => img.generated)).toEqual([true, false, false, false]);
  });

  it("leads every reader with the Generated Image while the Source Image stays in the gallery", async () => {
    const recipeId = crypto.randomUUID();
    const photo = url(recipeId, "photo");

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      images: [{ image: photo, order: 0 }],
    });

    await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

    expect((await dashboardRecipe(recipeId))?.image).toBe(url(recipeId, "drawn"));
    expect((await getRecipeFull(recipeId))?.images.map((img) => img.image)).toEqual([
      url(recipeId, "drawn"),
      photo,
    ]);
  });

  it("keeps a Source Image whose lowest stored order is not 0", async () => {
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

    expect(result?.replacedImageUrls).toEqual([]);
    expect((await getRecipeFull(recipeId))?.images.map((img) => img.image)).toEqual([
      url(recipeId, "drawn"),
      primary,
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

  it("sweeps a stray Generated Image and keeps the Source Image beside it", async () => {
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

    expect(result?.replacedImageUrls).toEqual([stray]);
    expect((await getRecipeFull(recipeId))?.images).toEqual([
      expect.objectContaining({ image: url(recipeId, "drawn"), order: 0, generated: true }),
      expect.objectContaining({ image: photo, order: 1, generated: false }),
    ]);
  });

  it("adds a Source Image at the end while the Generated Image does not count", async () => {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      images: [
        { image: url(recipeId, "photo"), order: 0 },
        { image: url(recipeId, "second"), order: 1 },
      ],
    });

    await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

    const added = await addGalleryImageWithinCap(recipeId, url(recipeId, "third"));

    expect(added).toMatchObject({ status: "added", image: { order: 3 } });
    expect((await getRecipeFull(recipeId))?.images.map((image) => image.image)).toEqual([
      url(recipeId, "drawn"),
      url(recipeId, "photo"),
      url(recipeId, "second"),
      url(recipeId, "third"),
    ]);
  });

  it("reaches the Source Image cap at ten and does not insert an eleventh", async () => {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      images: Array.from({ length: 10 }, (_, index) => ({
        image: url(recipeId, `source-${index}`),
        order: index,
      })),
    });

    const added = await addGalleryImageWithinCap(recipeId, url(recipeId, "eleventh"));

    expect(added).toEqual({ status: "cap-reached" });
    expect((await getRecipeFull(recipeId))?.images).toHaveLength(10);
  });

  it("reports a missing recipe without inserting", async () => {
    const missing = crypto.randomUUID();

    expect(await addGalleryImageWithinCap(missing, url(missing, "photo"))).toEqual({
      status: "recipe-missing",
    });
  });

  it("keeps the scalar when the gallery already holds ten Source Images", async () => {
    const recipeId = crypto.randomUUID();
    const legacy = url(recipeId, "legacy-hero");

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      images: Array.from({ length: 10 }, (_, index) => ({
        image: url(recipeId, `source-${index}`),
        order: index,
      })),
    });
    await plantLegacyScalar(recipeId, legacy);

    const result = await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));
    const full = await getRecipeFull(recipeId);

    // Ten Source Images plus one Generated Image. The scalar stays as the
    // record of the eleventh photo, so the write makes no twelfth row.
    expect(full?.images).toHaveLength(11);
    expect(full?.images.filter((image) => image.generated === false)).toHaveLength(10);
    expect(full?.image).toBe(legacy);
    expect(result?.replacedImageUrls).toEqual([]);
  });

  it("keeps the kept scalar when the edit form saves the full gallery", async () => {
    const recipeId = crypto.randomUUID();
    const legacy = url(recipeId, "legacy-hero");

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      images: Array.from({ length: 10 }, (_, index) => ({
        image: url(recipeId, `source-${index}`),
        order: index,
      })),
    });
    await plantLegacyScalar(recipeId, legacy);
    await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

    const formImages = ((await getRecipeFull(recipeId))?.images ?? []).map((image) => ({
      id: image.id,
      image: image.image,
      order: image.order,
      generated: image.generated,
    }));

    await updateRecipeWithRefs(recipeId, userId, { images: formImages });

    const after = await getRecipeFull(recipeId);

    // Ten Source Images still fill the cap, so the scalar stays in the column
    // and its file is never released.
    expect(after?.images).toHaveLength(11);
    expect(after?.image).toBe(legacy);
  });

  it("moves a kept scalar into a freed Source Image slot on the next save", async () => {
    const recipeId = crypto.randomUUID();
    const legacy = url(recipeId, "legacy-hero");

    await createRecipeWithRefs(recipeId, userId, {
      ...BASE_RECIPE,
      images: Array.from({ length: 10 }, (_, index) => ({
        image: url(recipeId, `source-${index}`),
        order: index,
      })),
    });
    await plantLegacyScalar(recipeId, legacy);
    await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

    const formImages = ((await getRecipeFull(recipeId))?.images ?? [])
      .filter((image) => image.image !== url(recipeId, "source-0"))
      .map((image) => ({
        id: image.id,
        image: image.image,
        order: image.order,
        generated: image.generated,
      }));

    await updateRecipeWithRefs(recipeId, userId, { images: formImages });

    const after = await getRecipeFull(recipeId);
    const sources = after?.images.filter((image) => image.generated === false) ?? [];

    // The freed slot receives the scalar as a Source Image row, and the column
    // is clear because a row now represents the file.
    expect(sources).toHaveLength(10);
    expect(sources.some((image) => image.image === legacy)).toBe(true);
    expect(after?.image).toBeNull();
  });

  it("returns null for a recipe that does not exist", async () => {
    const missing = crypto.randomUUID();

    expect(await replaceRecipePrimaryImageWithGenerated(missing, url(missing, "drawn"))).toBeNull();
  });

  // The replacement clears a scalar the gallery now carries, keeps a distinct
  // scalar when the Source Image cap is full, and releases only a file the
  // recipe no longer references.
  describe("the legacy thumbnail scalar", () => {
    it("is cleared while the photograph it names keeps its gallery row", async () => {
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
      // The gallery row still references the file, so nothing is released.
      expect(result?.replacedImageUrls).toEqual([]);
      expect((await getRecipeFull(recipeId))?.images.map((img) => img.image)).toEqual([
        url(recipeId, "drawn"),
        photo,
      ]);
    });

    it("is cleared on a legacy-only recipe, its photograph recovered as a Source Image", async () => {
      const recipeId = crypto.randomUUID();
      const legacy = url(recipeId, "legacy-hero");

      await createRecipeWithRefs(recipeId, userId, { ...BASE_RECIPE, images: [] });
      await plantLegacyScalar(recipeId, legacy);

      const result = await replaceRecipePrimaryImageWithGenerated(recipeId, url(recipeId, "drawn"));

      const full = await getRecipeFull(recipeId);

      expect(full?.image).toBeNull();
      expect(full?.images).toEqual([
        expect.objectContaining({ image: url(recipeId, "drawn"), order: 0, generated: true }),
        expect.objectContaining({ image: legacy, order: 1, generated: false }),
      ]);
      // A photograph recorded only in the deprecated scalar is still a Source
      // Image, so it survives with its file (ADR-0040).
      expect(result?.replacedImageUrls).toEqual([]);
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

      // Both rows survive and still reference the file.
      expect(result?.replacedImageUrls).toEqual([]);
      expect((await getRecipeFull(recipeId))?.images.map((img) => img.image)).toEqual([
        url(recipeId, "drawn"),
        shared,
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
