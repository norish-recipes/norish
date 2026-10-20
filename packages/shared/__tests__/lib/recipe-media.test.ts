// @vitest-environment node
/**
 * The one definition of the image a recipe leads with: the first gallery
 * image by order, falling back to the legacy scalar. Every thumbnail reader
 * resolves through this, which is what lets the `recipes.image` column head
 * toward removal.
 */
import { describe, expect, it } from "vitest";

import { primaryRecipeImage, promoteImageToThumbnail } from "@norish/shared/lib/recipe-media";

describe("primaryRecipeImage", () => {
  it("leads with the first gallery image by order, whatever the array order", () => {
    expect(
      primaryRecipeImage({
        image: "/recipes/r/legacy.jpg",
        images: [
          { image: "/recipes/r/second.jpg", order: 2 },
          { image: "/recipes/r/first.jpg", order: 0 },
        ],
      })
    ).toBe("/recipes/r/first.jpg");
  });

  it("falls back to the legacy scalar only when the gallery is empty", () => {
    expect(primaryRecipeImage({ image: "/recipes/r/legacy.jpg", images: [] })).toBe(
      "/recipes/r/legacy.jpg"
    );
    expect(primaryRecipeImage({ image: "/recipes/r/legacy.jpg" })).toBe("/recipes/r/legacy.jpg");
  });

  it("returns null when the recipe holds no image anywhere", () => {
    expect(primaryRecipeImage({ image: null, images: [] })).toBeNull();
    expect(primaryRecipeImage({})).toBeNull();
  });

  it("treats an unparseable order as 0, like the carousel does", () => {
    expect(
      primaryRecipeImage({
        images: [
          { image: "/recipes/r/odd.jpg", order: "not-a-number" },
          { image: "/recipes/r/late.jpg", order: 5 },
        ],
      })
    ).toBe("/recipes/r/odd.jpg");
  });
});

describe("promoteImageToThumbnail", () => {
  const gallery = [
    { image: "/recipes/r/first.jpg", order: 0 },
    { image: "/recipes/r/second.jpg", order: 1 },
    { image: "/recipes/r/third.jpg", order: 2 },
  ];

  it("leads with the chosen image and keeps the rest in their relative order", () => {
    expect(promoteImageToThumbnail(gallery, 2).map((image) => image.image)).toEqual([
      "/recipes/r/third.jpg",
      "/recipes/r/first.jpg",
      "/recipes/r/second.jpg",
    ]);
  });

  it("renumbers every item so the primary rule resolves the chosen image", () => {
    const promoted = promoteImageToThumbnail(gallery, 1);

    expect(promoted.map((image) => image.order)).toEqual([0, 1, 2]);
    expect(primaryRecipeImage({ images: promoted })).toBe("/recipes/r/second.jpg");
  });

  it("leaves a gallery whose first image is already the thumbnail unchanged", () => {
    expect(promoteImageToThumbnail(gallery, 0).map((image) => image.image)).toEqual(
      gallery.map((image) => image.image)
    );
    expect(promoteImageToThumbnail(gallery, 9).map((image) => image.image)).toEqual(
      gallery.map((image) => image.image)
    );
  });
});
