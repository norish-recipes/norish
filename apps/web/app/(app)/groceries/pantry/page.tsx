import { QuerySeed } from "@/components/query-seed";
import { PantryScreen } from "@/features/groceries/pantry-screen";
import { iconIds } from "@/lib/ingredient-icon-ids";

/**
 * What the Pantry's first frame draws: the Pantry and its foods' icons, what it suggests, and the
 * list, which its _On the list_ marks read.
 */
export default function PantryPage() {
  return (
    <QuerySeed
      reads={(trpc, client) => [
        (async () => {
          const items = await client.query(trpc.pantry.list.queryOptions());
          const ids = iconIds(items.map((item) => item.ingredientId));

          if (ids.length > 0) await client.query(trpc.ingredients.icons.queryOptions({ ids }));
        })(),
        client.query(trpc.pantry.suggestions.queryOptions()),
        client.query(trpc.groceries.list.queryOptions()),
      ]}
    >
      <PantryScreen />
    </QuerySeed>
  );
}
