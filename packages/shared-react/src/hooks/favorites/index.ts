import type { CreateFavoritesHooksOptions } from "./types";
import { useFavoritesMutation, useFavoritesQuery } from "../../recipes";

export type { CreateFavoritesHooksOptions } from "./types";
export type { FavoritesMutationResult, FavoritesQueryResult } from "../../recipes";

export function createFavoritesHooks(_options: CreateFavoritesHooksOptions) {
  return { useFavoritesQuery, useFavoritesMutation };
}
