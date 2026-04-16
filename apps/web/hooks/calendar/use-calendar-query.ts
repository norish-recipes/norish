"use client";

import { sharedCalendarHooks } from "./shared-calendar-hooks";

export const useCalendarQuery = sharedCalendarHooks.useCalendarQuery;

export type { CalendarData, CalendarQueryResult } from "@norish/shared-react/hooks";
