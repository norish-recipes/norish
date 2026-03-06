import { createUseFavoritesQuery } from "../recipes/dashboard/use-favorites-query";
import { createUseFavoritesMutation } from "../recipes/dashboard/use-favorites-mutation";

import type { CreateFavoritesHooksOptions } from "./types";

export type { CreateFavoritesHooksOptions } from "./types";
export type { FavoritesQueryResult } from "../recipes/dashboard/use-favorites-query";
export type { FavoritesMutationResult } from "../recipes/dashboard/use-favorites-mutation";

export function createFavoritesHooks({ useTRPC }: CreateFavoritesHooksOptions) {
  return {
    useFavoritesQuery: createUseFavoritesQuery({ useTRPC }),
    useFavoritesMutation: createUseFavoritesMutation({ useTRPC }),
  };
}
