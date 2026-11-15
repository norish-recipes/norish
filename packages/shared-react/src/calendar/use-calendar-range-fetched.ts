import { useEffect, useState } from "react";
import { hashKey, useQueryClient } from "@tanstack/react-query";

import type { CalendarRange } from "@norish/shared/lib/helpers";

import { useTRPC } from "../trpc";

/**
 * Whether `range` was fetched while this is mounted. A seeded range holds only what other ranges
 * knew, and writes land in it too, so neither counts as knowing its days.
 */
export function useCalendarRangeFetched(range: CalendarRange): boolean {
  const queryClient = useQueryClient();
  const rangeHash = hashKey(useTRPC().calendar.listItems.queryKey(range));
  const [fetchedHash, setFetchedHash] = useState<string | null>(null);

  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (
          event.type === "updated" &&
          event.action.type === "success" &&
          !event.action.manual &&
          event.query.queryHash === rangeHash
        )
          setFetchedHash(rangeHash);
      }),
    [queryClient, rangeHash]
  );

  return fetchedHash === rangeHash;
}
