import { QuerySeed } from "@/components/query-seed";
import { PantryScreen } from "@/features/groceries/pantry-screen";

/**
 * What the Pantry's first frame draws: the Pantry, what it suggests, and the list, which its
 * _On the list_ marks read.
 */
export default function PantryPage() {
  return (
    <QuerySeed
      reads={(trpc, client) => [
        client.query(trpc.pantry.list.queryOptions()),
        client.query(trpc.pantry.suggestions.queryOptions()),
        client.query(trpc.groceries.list.queryOptions()),
      ]}
    >
      <PantryScreen />
    </QuerySeed>
  );
}
