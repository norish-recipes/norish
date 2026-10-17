import { QuerySeed } from "@/components/query-seed";
import { hiddenItemVisibility } from "@/lib/hidden-items";
import { readDevicePreferencesSeed } from "@/lib/request-profile";

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
        const { values } = await readDevicePreferencesSeed();

        return [
          ...recipe,
          hiddenItemVisibility(values.hiddenItems).showCookbooks &&
            client.query(trpc.cookbooks.forRecipe.queryOptions({ recipeId: id })),
        ];
      }}
    >
      {children}
    </QuerySeed>
  );
}
