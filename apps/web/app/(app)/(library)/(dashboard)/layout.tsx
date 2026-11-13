import { QuerySeed } from "@/components/query-seed";
import { readReaderToday } from "@/lib/reader-today-server";
import { readRecipeQueryFilters } from "@/lib/recipe-filters-server";

import { byNextCursor, libraryListInput } from "@norish/shared/contracts/list-queries";
import { getInitialCalendarRange } from "@norish/shared/lib/helpers";

// A full load carries Today's meals' week in the reader's zone, the Library's first page and the
// running imports, above the loading boundary so the skeleton's first render has them.
export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const [today, filters] = await Promise.all([readReaderToday(), readRecipeQueryFilters()]);
  const week = getInitialCalendarRange("desktop", today);

  return (
    <QuerySeed
      reads={(trpc, client) => [
        client.query(trpc.calendar.listItems.queryOptions(week)),
        filters &&
          client.infiniteQuery(
            trpc.library.list.infiniteQueryOptions(libraryListInput(filters), byNextCursor)
          ),
        client.query(trpc.recipes.getPending.queryOptions()),
      ]}
    >
      {children}
    </QuerySeed>
  );
}
