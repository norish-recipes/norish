import type { FullRecipeDTO } from "@norish/shared/contracts";
import type {
  PublicRecipeViewDTO,
  RecipeShareDto,
  RecipeShareSummaryDto,
} from "@norish/shared/contracts/dto/recipe-shares";
import {
  PublicRecipeViewSchema,
  RecipeShareSummarySchema,
} from "@norish/shared/contracts/zod/recipe-shares";

export type RecipeShareStatus = "active" | "expired" | "revoked";
export type RecipeShareExpiryPolicy = "1day" | "1week" | "1month" | "1year" | "forever";

export function getRecipeShareStatus(
  share: Pick<RecipeShareDto, "expiresAt" | "revokedAt">
): RecipeShareStatus {
  if (share.revokedAt) {
    return "revoked";
  }

  if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) {
    return "expired";
  }

  return "active";
}

export function toRecipeShareSummary(share: RecipeShareDto): RecipeShareSummaryDto {
  return RecipeShareSummarySchema.parse({
    ...share,
    status: getRecipeShareStatus(share),
  });
}

export function resolveRecipeShareExpiresAt(
  policy: RecipeShareExpiryPolicy,
  now = new Date()
): Date | null {
  const expiresAt = new Date(now);

  switch (policy) {
    case "1day":
      expiresAt.setDate(expiresAt.getDate() + 1);

      return expiresAt;
    case "1week":
      expiresAt.setDate(expiresAt.getDate() + 7);

      return expiresAt;
    case "1month":
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      return expiresAt;
    case "1year":
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      return expiresAt;
    case "forever":
      return null;
  }
}

export function toSharedMediaUrl(
  url: string | null | undefined,
  shareToken: string
): string | null {
  if (!url) {
    return null;
  }

  if (!url.startsWith("/recipes/")) {
    return url;
  }

  const [pathname] = url.split("?", 1);
  const stepMatch = pathname?.match(/^\/recipes\/[^/]+\/steps\/([^/]+)$/);

  if (stepMatch?.[1]) {
    return `/share/${shareToken}/steps/${stepMatch[1]}`;
  }

  const mediaMatch = pathname?.match(/^\/recipes\/[^/]+\/([^/]+)$/);

  if (mediaMatch?.[1]) {
    return `/share/${shareToken}/media/${mediaMatch[1]}`;
  }

  return url;
}

export function mapRecipeToPublicRecipeView(
  recipe: FullRecipeDTO,
  shareToken: string
): PublicRecipeViewDTO {
  return PublicRecipeViewSchema.parse({
    name: recipe.name,
    description: recipe.description ?? null,
    notes: recipe.notes ?? null,
    url: recipe.url ?? null,
    image: toSharedMediaUrl(recipe.image, shareToken),
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes ?? null,
    cookMinutes: recipe.cookMinutes ?? null,
    totalMinutes: recipe.totalMinutes ?? null,
    systemUsed: recipe.systemUsed,
    calories: recipe.calories ?? null,
    fat: recipe.fat ?? null,
    carbs: recipe.carbs ?? null,
    protein: recipe.protein ?? null,
    categories: recipe.categories ?? [],
    tags: (recipe.tags ?? []).map((tag) => ({ name: tag.name })),
    recipeIngredients: (recipe.recipeIngredients ?? []).map((ingredient) => ({
      ingredientName: ingredient.ingredientName,
      amount: ingredient.amount,
      unit: ingredient.unit ?? null,
      systemUsed: ingredient.systemUsed,
      order: ingredient.order,
    })),
    steps: (recipe.steps ?? []).map((step) => ({
      step: step.step,
      systemUsed: step.systemUsed,
      order: step.order,
      images: (step.images ?? []).map((image) => ({
        image: toSharedMediaUrl(image.image, shareToken),
        order: image.order,
      })),
    })),
    author: recipe.author
      ? {
          name: recipe.author.name ?? null,
          image: recipe.author.image ?? null,
        }
      : null,
    images: (recipe.images ?? []).map((image) => ({
      image: toSharedMediaUrl(image.image, shareToken),
      order: image.order,
    })),
    videos: (recipe.videos ?? []).map((video) => ({
      video: toSharedMediaUrl(video.video, shareToken),
      thumbnail: toSharedMediaUrl(video.thumbnail ?? null, shareToken),
      duration: video.duration ?? null,
      order: video.order,
    })),
  });
}
