import { getInitialDateRange } from "@/app/(app)/calendar/context-helpers";
import { Dashboard } from "@/components/dashboard/dashboard";
import { QuerySeed } from "@/components/query-seed";
import { readReaderToday } from "@/lib/reader-today-server";
import { readRecipeQueryFilters } from "@/lib/recipe-filters-server";

import { libraryListInput } from "@norish/shared-react/filter-contract";
import { dateKey } from "@norish/shared/lib/helpers";

// Signed in by now. A full load carries the week Today's meals reads, in the reader's time zone,
// and the Library's first page under the filters the browser has told the server.
export default async function Home() {
  const [today, filters] = await Promise.all([readReaderToday(), readRecipeQueryFilters()]);
  const { start, end } = getInitialDateRange("desktop", today);

  return (
    <QuerySeed
      reads={(trpc, client) => [
        client.query(
          trpc.calendar.listItems.queryOptions({ startISO: dateKey(start), endISO: dateKey(end) })
        ),
        ...(filters
          ? [
              client.infiniteQuery(
                trpc.library.list.infiniteQueryOptions(libraryListInput(filters), {
                  getNextPageParam: (lastPage) => lastPage.nextCursor,
                })
              ),
            ]
          : []),
      ]}
    >
      <Dashboard />
    </QuerySeed>
  );
}
