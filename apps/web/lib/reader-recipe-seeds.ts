import type { Reads } from "@/components/query-seed";

/**
 * What a recipe card or page draws of the Reader: their favourites, and the allergies it warns
 * about, the household's else their own. The Library's and the recipe page's layouts seed these.
 */
export function readerRecipeSeeds(...[trpc, client]: Parameters<Reads>) {
  return [
    client.query(trpc.favorites.list.queryOptions()),
    client.query(trpc.households.get.queryOptions()),
    client.query(trpc.user.getAllergies.queryOptions()),
  ];
}
