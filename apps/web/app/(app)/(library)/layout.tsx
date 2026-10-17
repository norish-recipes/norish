import { getInitialDateRange } from "@/app/(app)/calendar/context-helpers";
import { QuerySeed } from "@/components/query-seed";
import { readReaderToday } from "@/lib/reader-today-server";
import { readRecipeQueryFilters } from "@/lib/recipe-filters-server";

import { byNextCursor, libraryListInput } from "@norish/shared-react/list-queries";
import { dateKey } from "@norish/shared/lib/helpers";

// A full load carries the week Today's meals reads, in the reader's time zone, and the Library's
// first page. Here above the loading boundary, so the app's providers find it in their first render.
export default async function LibraryLayout({ children }: LayoutProps<"/">) {
  const [today, filters] = await Promise.all([readReaderToday(), readRecipeQueryFilters()]);
  const { start, end } = getInitialDateRange("desktop", today);

  return (
    <QuerySeed
      reads={(trpc, client) => [
        client.query(
          trpc.calendar.listItems.queryOptions({ startISO: dateKey(start), endISO: dateKey(end) })
        ),
        filters &&
          client.infiniteQuery(
            trpc.library.list.infiniteQueryOptions(libraryListInput(filters), byNextCursor)
          ),
      ]}
    >
      {children}
    </QuerySeed>
  );
}
