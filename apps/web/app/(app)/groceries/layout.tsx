import { QuerySeed } from "@/components/query-seed";

import { GroceriesScreen } from "./groceries-screen";

/**
 * Both views of Groceries under one layout, which renders the view itself:
 * the pages only give each view an address, so switching between the list
 * and the Pantry stays on the client. The stored view and grouping come from
 * the App Shell's Device Preferences, already in the server's first frame.
 */
export default function GroceriesLayout() {
  return (
    // What either view's first frame draws: the list, its stores, prices and aisles, and the
    // Pantry with what it suggests.
    <QuerySeed
      reads={(trpc, client) => [
        client.query(trpc.groceries.list.queryOptions()),
        client.query(trpc.stores.list.queryOptions()),
        client.query(trpc.stores.groceryPrices.queryOptions()),
        client.query(trpc.stores.aisleLinks.queryOptions()),
        client.query(trpc.pantry.list.queryOptions()),
        client.query(trpc.pantry.suggestions.queryOptions()),
      ]}
    >
      <GroceriesScreen />
    </QuerySeed>
  );
}
