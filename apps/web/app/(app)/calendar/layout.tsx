import { QuerySeed } from "@/components/query-seed";
import { readReaderToday } from "@/lib/reader-today-server";

import { dateKey } from "@norish/shared/lib/helpers";

import { getInitialDateRange } from "./context-helpers";

/** A full load of the calendar carries its opening range, worked out in the reader's time zone. */
export default async function CalendarLayout({ children }: { children: React.ReactNode }) {
  const { start, end } = getInitialDateRange("mobile", await readReaderToday());

  return (
    <QuerySeed
      reads={(trpc, client) => [
        client.query(
          trpc.calendar.listItems.queryOptions({ startISO: dateKey(start), endISO: dateKey(end) })
        ),
      ]}
    >
      {children}
    </QuerySeed>
  );
}
