import type { RecipeDashboardDTO } from "@norish/shared/contracts";

import type { RecipeCardItem } from "./recipe-card.types";
import { resolveImageUrl } from "./resolve-image-url";

type RecipeCardMappingOptions = {
  favoriteIds?: Set<string>;
  allergies?: string[];
};

export function mapDashboardRecipeToCardItem(
  recipe: RecipeDashboardDTO,
  backendBaseUrl: string | null,
  authCookie: string | null,
  options: RecipeCardMappingOptions = {}
): RecipeCardItem {
  const imageSource = resolveImageUrl(recipe.image, backendBaseUrl, authCookie);
  return {
    id: recipe.id,
    version: recipe.version,
    ownerId: recipe.userId,
    imageUrl: imageSource?.uri ?? "",
    imageHeaders: imageSource?.headers,
    title: recipe.name,
    description: recipe.description ?? "",
    servings: recipe.servings,
    rating: Math.max(0, Math.min(5, Math.round(recipe.averageRating ?? 0))),
    tags: (recipe.tags ?? []).map((tag) => (typeof tag === "string" ? tag : tag.name)),
    categories: recipe.categories?.slice(0, 4),
    course: recipe.categories?.[0] ?? "",
    liked: options.favoriteIds?.has(recipe.id) ?? false,
    allergies: options.allergies ?? [],
    totalDurationMinutes: recipe.totalMinutes ?? 0,
  };
}
