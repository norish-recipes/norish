// @vitest-environment node
/**
 * The gallery limits every payload and every read applies: ten Source Images
 * and one Generated Image at most (ADR-0040). The Generated Image does not
 * consume a person's slot.
 */
import { describe, expect, it } from "vitest";

import {
  FullRecipeInsertObjectSchema,
  FullRecipeInsertSchema,
  FullRecipeUpdateSchema,
} from "@norish/shared/contracts/zod/recipe";
import {
  MAX_RECIPE_GALLERY_IMAGES,
  RecipeImagesArraySchema,
} from "@norish/shared/contracts/zod/recipe-images";

function sourceImage(index: number) {
  return { image: `/recipes/r/source-${index}.jpg`, order: index };
}

function generatedImage(index = 0) {
  return { image: `/recipes/r/drawn-${index}.jpg`, order: 100 + index, generated: true };
}

function gallery(sources: number, generated = 0) {
  return [
    ...Array.from({ length: sources }, (_, index) => sourceImage(index)),
    ...Array.from({ length: generated }, (_, index) => generatedImage(index)),
  ];
}

function outputGallery(sources: number, generated = 0) {
  return gallery(sources, generated).map((image) => ({
    ...image,
    id: crypto.randomUUID(),
    version: 1,
  }));
}

describe("recipe gallery limits", () => {
  it("accepts ten Source Images and one Generated Image", () => {
    expect(FullRecipeInsertSchema.safeParse({ name: "Stew", images: gallery(10, 1) }).success).toBe(
      true
    );
    expect(FullRecipeUpdateSchema.safeParse({ images: gallery(10, 1) }).success).toBe(true);
    expect(RecipeImagesArraySchema.safeParse(outputGallery(10, 1)).success).toBe(true);
  });

  it("keeps the insert object schema derivable for the archive", () => {
    expect(FullRecipeInsertObjectSchema.pick({ categories: true }).parse({}).categories).toEqual(
      []
    );
    expect(
      FullRecipeInsertObjectSchema.omit({ id: true, cuisines: true }).parse({ name: "Stew" }).name
    ).toBe("Stew");
  });

  it("accepts a gallery with no Generated Image", () => {
    expect(FullRecipeInsertSchema.safeParse({ name: "Stew", images: gallery(10, 0) }).success).toBe(
      true
    );
  });

  it("rejects eleven Source Images", () => {
    const parsed = FullRecipeInsertSchema.safeParse({ name: "Stew", images: gallery(11, 0) });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.message)).toContain(
      "A recipe can hold at most 10 Source Images"
    );
  });

  it("rejects a second Generated Image", () => {
    const parsed = FullRecipeUpdateSchema.safeParse({ images: gallery(10, 2) });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.message)).toContain(
      "A recipe can hold at most one Generated Image"
    );
  });

  it("rejects a twelve-row gallery on read", () => {
    expect(MAX_RECIPE_GALLERY_IMAGES).toBe(11);
    expect(RecipeImagesArraySchema.safeParse(outputGallery(10, 2)).success).toBe(false);
    expect(RecipeImagesArraySchema.safeParse(outputGallery(11, 1)).success).toBe(false);
  });
});
