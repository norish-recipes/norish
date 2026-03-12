import type { RecipeDashboardDTO } from '@norish/shared/contracts';

import type { RecipeCardItem } from './recipe-card.types';

type RecipeCardMappingOptions = {
  favoriteIds?: Set<string>;
  allergies?: string[];
};

function resolveRecipeImageUrl(image: string | null, backendBaseUrl: string | null): string {
  if (!image) return '';
  if (/^https?:\/\//i.test(image)) return image;
  if (!backendBaseUrl) return image;

  return `${backendBaseUrl.replace(/\/+$/, '')}/${image.replace(/^\/+/, '')}`;
}

export function mapDashboardRecipeToCardItem(
  recipe: RecipeDashboardDTO,
  backendBaseUrl: string | null,
  authCookie: string | null,
  options: RecipeCardMappingOptions = {},
): RecipeCardItem {
  return {
    id: recipe.id,
    ownerId: recipe.userId,
    imageUrl: resolveRecipeImageUrl(recipe.image, backendBaseUrl),
    imageHeaders: authCookie ? { Cookie: authCookie } : undefined,
    title: recipe.name,
    description: recipe.description ?? '',
    servings: recipe.servings,
    rating: Math.max(0, Math.min(5, Math.round(recipe.averageRating ?? 0))),
    tags: (recipe.tags ?? []).map((tag) => (typeof tag === 'string' ? tag : tag.name)),
    categories: recipe.categories?.slice(0, 4),
    course: recipe.categories?.[0] ?? '',
    liked: options.favoriteIds?.has(recipe.id) ?? false,
    allergies: options.allergies ?? [],
    totalDurationMinutes: recipe.totalMinutes ?? 0,
  };
}
