import { QuerySeed } from "@/components/query-seed";
import { GroceriesListScreen } from "@/features/groceries/groceries-list-screen";

/** What the list's first frame draws: the list, its stores, prices and aisles. */
export default function GroceriesPage() {
  return (
    <QuerySeed
      reads={(trpc, client) => [
        client.query(trpc.groceries.list.queryOptions()),
        client.query(trpc.stores.list.queryOptions()),
        client.query(trpc.stores.groceryPrices.queryOptions()),
        client.query(trpc.stores.aisleLinks.queryOptions()),
      ]}
    >
      <GroceriesListScreen />
    </QuerySeed>
  );
}
