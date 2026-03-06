"use client";

import { sharedCalendarHooks } from "./shared-calendar-hooks";

export const useCalendarQuery = sharedCalendarHooks.useCalendarQuery;
export type { CalendarData, CalendarQueryResult } from "@norish/shared-react/hooks";

export const useCalendarMutations = sharedCalendarHooks.useCalendarMutations;
export type { CalendarMutationsResult } from "@norish/shared-react/hooks";

export const useCalendarSubscription = sharedCalendarHooks.useCalendarSubscription;

export const useCalendarCacheHelpers = sharedCalendarHooks.useCalendarCacheHelpers;
export type { CalendarCacheHelpers } from "@norish/shared-react/hooks";

// Web-only hook — depends on browser DnD APIs
export { useCalendarDnd } from "./use-calendar-dnd";
