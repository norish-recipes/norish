/**
 * Maps FullRecipeDTO.steps into the shape consumed by RecipeSteps and CookMode.
 */

import type { FullRecipeDTO } from "@norish/shared/contracts";

import { resolveImageUri } from "./resolve-image-url";

/** The shape RecipeSteps and CookMode components expect */
export type MappedStep = {
  /** The instruction text (may contain markdown formatting) */
  text: string;
  /** Optional images attached to this step */
  images?: { image: string }[];
};

/**
 * Transform FullRecipeDTO.steps into MappedStep[], resolving image URLs.
 * Steps are sorted by their `order` field.
 */
export function mapRecipeToSteps(
  recipe: FullRecipeDTO,
  backendBaseUrl: string | null
): MappedStep[] {
  const sorted = [...(recipe.steps ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return sorted.map((step) => ({
    text: step.step ?? "",
    images:
      step.images && step.images.length > 0
        ? step.images.map((img) => ({
            image: resolveImageUri(img.image, backendBaseUrl),
          }))
        : undefined,
  }));
}
