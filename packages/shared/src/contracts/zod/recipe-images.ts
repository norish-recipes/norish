import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { recipeImages } from "@norish/db-schema/schema";

import { countSourceImages, MAX_RECIPE_IMAGES } from "../../lib/recipe-media";

export const RecipeImageSelectSchema = createSelectSchema(recipeImages);
export const RecipeImageInsertSchema = createInsertSchema(recipeImages).omit({
  id: true,
  createdAt: true,
});

export const RecipeImageOutputSchema = z.object({
  id: z.uuid(),
  image: z.string(),
  order: z.coerce.number().default(0),
  /** A Generated Image, drawn by AI (ADR-0025). Carried for archive export; never rendered. */
  generated: z.boolean().default(false),
  version: z.number(),
});

export const RecipeImageSchema = z.object({
  id: z.uuid().optional(),
  image: z.string(),
  order: z.coerce.number().default(0),
  /**
   * Optional without a default on purpose: an absent field carries no intent,
   * so an edit-form save or an old archive can never clear a stored marking.
   */
  generated: z.boolean().optional(),
  version: z.number().int().positive().optional(),
});

export const RecipeImageInputSchema = z.object({
  image: z.string(),
  order: z.coerce.number().default(0),
});

export const DeleteRecipeImageInputSchema = z.object({
  imageId: z.uuid(),
  version: z.number().int().positive(),
});

export { MAX_RECIPE_IMAGES };

export const MAX_RECIPE_GALLERY_IMAGES = MAX_RECIPE_IMAGES + 1;

export function refineRecipeGallery(
  images: readonly { generated?: boolean }[],
  ctx: z.RefinementCtx
): void {
  const sourceImages = countSourceImages(images);
  const generatedImages = images.length - sourceImages;

  if (sourceImages > MAX_RECIPE_IMAGES) {
    ctx.addIssue({
      code: "custom",
      message: `A recipe can hold at most ${MAX_RECIPE_IMAGES} Source Images`,
      path: ["images"],
    });
  }

  if (generatedImages > 1) {
    ctx.addIssue({
      code: "custom",
      message: "A recipe can hold at most one Generated Image",
      path: ["images"],
    });
  }
}

export const RecipeImagesArraySchema = z
  .array(RecipeImageOutputSchema)
  .max(MAX_RECIPE_GALLERY_IMAGES)
  .superRefine(refineRecipeGallery);
export const RecipeImagesInputArraySchema = z.array(RecipeImageInputSchema).max(MAX_RECIPE_IMAGES);
