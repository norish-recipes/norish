import { headers } from "next/headers";
import { QuerySeed } from "@/components/query-seed";
import { GroceriesRoot } from "@/features/groceries/groceries-root";
import { groceriesView } from "@/features/groceries/lib/groceries-view";
import { DESTINATION_HEADER } from "@/lib/auth/login-redirect";
import { iconIds } from "@/lib/ingredient-icon-ids";

/**
 * Both views of Groceries under one layout, which renders the root: the pages only give each view
 * an address, so switching between the list and the Pantry stays on the client. The stored view
 * and grouping come from the App Shell's Device Preferences, already in the server's first frame.
 */
export default async function GroceriesLayout() {
  // A layout isn't told its path, so the proxy's copy of it says which view a full load opens on.
  const view = groceriesView((await headers()).get(DESTINATION_HEADER));

  return (
    <QuerySeed
      reads={(trpc, client) => {
        const withIcons = async (foods: Promise<(string | null | undefined)[]>) => {
          const ids = iconIds(await foods);

          if (ids.length > 0) await client.query(trpc.ingredients.icons.queryOptions({ ids }));
        };

        // What the opening view's first frame draws; a first switch to the other reads it then.
        return view === "pantry"
          ? [
              // The Pantry and its foods' icons, what it suggests, and the list its _On the list_
              // marks read.
              withIcons(
                client
                  .query(trpc.pantry.list.queryOptions())
                  .then((items) => items.map((item) => item.ingredientId))
              ),
              client.query(trpc.pantry.suggestions.queryOptions()),
              client.query(trpc.groceries.list.queryOptions()),
            ]
          : [
              // The list and its foods' icons, its stores, prices and aisles.
              withIcons(
                client
                  .query(trpc.groceries.list.queryOptions())
                  .then((list) =>
                    [...list.groceries, ...list.recurringGroceries].map((item) => item.ingredientId)
                  )
              ),
              client.query(trpc.stores.list.queryOptions()),
              client.query(trpc.stores.groceryPrices.queryOptions()),
              client.query(trpc.stores.aisleLinks.queryOptions()),
            ];
      }}
    >
      <GroceriesRoot />
    </QuerySeed>
  );
}
