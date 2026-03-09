import type { CreateCalendarHooksOptions } from "./types";
import { createUseCalendarCache } from "./use-calendar-cache";
import { createUseCalendarMutations } from "./use-calendar-mutations";
import { createUseCalendarQuery } from "./use-calendar-query";
import { createUseCalendarSubscription } from "./use-calendar-subscription";

export type {
  CreateCalendarHooksOptions,
  CalendarCacheHelpers,
  CalendarData,
  CalendarMutationsResult,
  CalendarQueryResult,
} from "./types";

export { createUseCalendarQuery } from "./use-calendar-query";
export { createUseCalendarMutations } from "./use-calendar-mutations";
export { createUseCalendarCache } from "./use-calendar-cache";
export { createUseCalendarSubscription } from "./use-calendar-subscription";

export function createCalendarHooks({ useTRPC }: CreateCalendarHooksOptions) {
  const useCalendarQuery = createUseCalendarQuery({ useTRPC });
  const useCalendarCacheHelpers = createUseCalendarCache({ useTRPC });
  const useCalendarMutations = createUseCalendarMutations({ useTRPC, useCalendarCacheHelpers });
  const useCalendarSubscription = createUseCalendarSubscription({
    useTRPC,
    useCalendarCacheHelpers,
  });

  return {
    useCalendarQuery,
    useCalendarMutations,
    useCalendarCacheHelpers,
    useCalendarSubscription,
  };
}
