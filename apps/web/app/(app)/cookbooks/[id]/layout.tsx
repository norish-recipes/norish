import { QuerySeed } from "@/components/query-seed";
import { readRecipeQueryFilters } from "@/lib/recipe-filters-server";

import { cookbookRecipesInput } from "@norish/shared-react/filter-contract";

// The cookbook, and its members under the filters the browser has told the server.
export default async function CookbookLayout({ children, params }: LayoutProps<"/cookbooks/[id]">) {
  const [{ id }, filters] = await Promise.all([params, readRecipeQueryFilters()]);

  return (
    <QuerySeed
      reads={(trpc, client) => [
        client.query(trpc.cookbooks.get.queryOptions({ id })),
        ...(filters
          ? [
              client.infiniteQuery(
                trpc.cookbooks.recipes.infiniteQueryOptions(cookbookRecipesInput(id, filters), {
                  getNextPageParam: (lastPage) => lastPage.nextCursor,
                })
              ),
            ]
          : []),
      ]}
    >
      {children}
    </QuerySeed>
  );
}
