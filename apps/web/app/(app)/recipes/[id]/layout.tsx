import { QuerySeed } from "@/components/query-seed";
import { readerRecipeSeeds } from "@/lib/reader-recipe-seeds";
import { readRequestProfile } from "@/lib/request-profile";

import { hiddenItemVisibility } from "@norish/shared-react/reader";
import { deviceBlocks } from "@norish/shared/contracts/zod/device-preferences";

export default async function RecipeLayout({ children, params }: LayoutProps<"/recipes/[id]">) {
  const { id } = await params;

  return (
    <QuerySeed
      reads={async (trpc, client) => {
        const recipe = [
          client.query(trpc.recipes.get.queryOptions({ id })),
          client.query(trpc.ratings.getAverage.queryOptions({ recipeId: id })),
          client.query(trpc.ratings.getUserRating.queryOptions({ recipeId: id })),
        ];
        // Read inside the seed, so an in-app tap skips it: the cookbooks card asks only where shown.
        const { kind, preferences } = await readRequestProfile();
        const { hiddenItems } = deviceBlocks(preferences)[kind];

        return [
          ...recipe,
          ...readerRecipeSeeds(trpc, client),
          hiddenItemVisibility(hiddenItems).showCookbooks &&
            client.query(trpc.cookbooks.forRecipe.queryOptions({ recipeId: id })),
        ];
      }}
    >
      {children}
    </QuerySeed>
  );
}
