import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

import type { CalendarCacheHelpers, CreateCalendarHooksOptions } from "./types";

export function createUseCalendarCache({ useTRPC }: CreateCalendarHooksOptions) {
  return function useCalendarCacheHelpers(startISO: string, endISO: string): CalendarCacheHelpers {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.calendar.listItems.queryKey({ startISO, endISO });

    const setCalendarData = useCallback(
      (
        updater: (prev: PlannedItemFromQuery[] | undefined) => PlannedItemFromQuery[] | undefined
      ) => {
        queryClient.setQueryData<PlannedItemFromQuery[]>(queryKey, updater);
      },
      [queryClient, queryKey]
    );

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    return { setCalendarData, invalidate };
  };
}
