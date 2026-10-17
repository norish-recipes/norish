import { QuerySeed } from "@/components/query-seed";
import { readDevicePreferencesSeed } from "@/lib/request-profile";

export default async function RecipeLayout({ children, params }: LayoutProps<"/recipes/[id]">) {
  const { id } = await params;
  // The cookbooks card asks only where the reader shows it.
  const { values } = await readDevicePreferencesSeed();
  const showsCookbooks = !values.hiddenItems.includes("cookbooks");

  return (
    <QuerySeed
      reads={(trpc, client) => [
        client.query(trpc.recipes.get.queryOptions({ id })),
        client.query(trpc.ratings.getAverage.queryOptions({ recipeId: id })),
        client.query(trpc.ratings.getUserRating.queryOptions({ recipeId: id })),
        ...(showsCookbooks
          ? [client.query(trpc.cookbooks.forRecipe.queryOptions({ recipeId: id }))]
          : []),
      ]}
    >
      {children}
    </QuerySeed>
  );
}
