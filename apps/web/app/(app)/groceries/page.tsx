import { QuerySeed } from "@/components/query-seed";
import { GroceriesListScreen } from "@/features/groceries/groceries-list-screen";
import { iconIds } from "@/lib/ingredient-icon-ids";

/** What the list's first frame draws: the list and its foods' icons, its stores, prices, aisles. */
export default function GroceriesPage() {
  return (
    <QuerySeed
      reads={(trpc, client) => [
        (async () => {
          const list = await client.query(trpc.groceries.list.queryOptions());
          const ids = iconIds(
            [...list.groceries, ...list.recurringGroceries].map((item) => item.ingredientId)
          );

          if (ids.length > 0) await client.query(trpc.ingredients.icons.queryOptions({ ids }));
        })(),
        client.query(trpc.stores.list.queryOptions()),
        client.query(trpc.stores.groceryPrices.queryOptions()),
        client.query(trpc.stores.aisleLinks.queryOptions()),
      ]}
    >
      <GroceriesListScreen />
    </QuerySeed>
  );
}
