// @vitest-environment node
/** A recipe's gallery, video and step-image rows only ever name that recipe's own files. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ForeignRecipeMediaError } from "@norish/db/repositories/recipe-media-references";
import {
  addRecipeImages,
  addRecipeVideos,
  getRecipeFull,
  isRecipeMediaReferenced,
} from "@norish/db/repositories/recipes";

import { createTestRecipe, createTestUser } from "../../../helpers/db-test-helpers";
import { createRecipeWithRefs, updateRecipeWithRefs } from "../../../helpers/recipe-writes";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("recipe media references", () => {
  const testBase = new RepositoryTestBase("test_recipe_media_refs");
  let ownerId: string;
  let victimRecipeId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
    ownerId = (await createTestUser()).id;
    victimRecipeId = (await createTestRecipe((await createTestUser()).id)).id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const base = { name: "Soup", systemUsed: "metric" as const, recipeIngredients: [], tags: [] };
  const foreign = () => `/recipes/${victimRecipeId}/a.jpg`;

  it("refuses a create whose gallery, video or step image names another recipe's file", async () => {
    for (const media of [
      { steps: [], images: [{ image: foreign(), order: 0 }] },
      { steps: [], videos: [{ video: `/recipes/${victimRecipeId}/video-1.mp4`, order: 0 }] },
      {
        steps: [
          {
            step: "Stir",
            order: 0,
            systemUsed: "metric" as const,
            images: [{ image: `/recipes/${victimRecipeId}/steps/a.jpg`, order: 0 }],
          },
        ],
      },
    ]) {
      const id = crypto.randomUUID();

      await expect(createRecipeWithRefs(id, ownerId, { ...base, ...media })).rejects.toThrow(
        ForeignRecipeMediaError
      );
      expect(await getRecipeFull(id)).toBeNull();
    }
  });

  it("keeps its own files and remote ones", async () => {
    const id = crypto.randomUUID();

    await createRecipeWithRefs(id, ownerId, {
      ...base,
      steps: [],
      images: [
        { image: `/recipes/${id}/a.jpg`, order: 0 },
        { image: "https://example.com/b.jpg", order: 1 },
      ],
    });

    expect((await getRecipeFull(id))?.images.map((i) => i.image)).toEqual([
      `/recipes/${id}/a.jpg`,
      "https://example.com/b.jpg",
    ]);
  });

  it("refuses an update or a gallery add that names another recipe's file", async () => {
    const id = crypto.randomUUID();

    await createRecipeWithRefs(id, ownerId, { ...base, steps: [] });

    await expect(
      updateRecipeWithRefs(id, ownerId, { images: [{ image: foreign(), order: 0 }] })
    ).rejects.toThrow(ForeignRecipeMediaError);
    await expect(
      updateRecipeWithRefs(id, ownerId, {
        steps: [
          {
            step: "Stir",
            order: 0,
            systemUsed: "metric",
            images: [{ image: `/recipes/${victimRecipeId}/steps/a.jpg`, order: 0 }],
          },
        ],
      })
    ).rejects.toThrow(ForeignRecipeMediaError);
    await expect(addRecipeImages(id, [{ image: foreign(), order: 0 }])).rejects.toThrow(
      ForeignRecipeMediaError
    );
    await expect(
      addRecipeVideos(id, [{ video: `/recipes/${id}/video-1.mp4`, thumbnail: foreign(), order: 0 }])
    ).rejects.toThrow(ForeignRecipeMediaError);
    expect((await getRecipeFull(id))?.images).toEqual([]);
  });

  it("tells whether a gallery image, video or thumbnail row still names a file", async () => {
    const id = victimRecipeId;

    await addRecipeImages(id, [{ image: `/recipes/${id}/a.jpg`, order: 0 }]);
    await addRecipeVideos(id, [
      { video: `/recipes/${id}/video-1.mp4`, thumbnail: `/recipes/${id}/t.jpg`, order: 0 },
    ]);

    expect(
      await Promise.all(
        ["a.jpg", "video-1.mp4", "t.jpg", "b.jpg"].map((f) =>
          isRecipeMediaReferenced(`/recipes/${id}/${f}`)
        )
      )
    ).toEqual([true, true, true, false]);
  });
});
