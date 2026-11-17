import { addDays, dateKey, parseDateKey } from "@norish/shared/lib/helpers";

/** How many days the move strip shows, from today. */
export const STRIP_DAYS = 14;

/** The strip's days as date keys, today's first. */
export const stripDays = (today: string) =>
  Array.from({ length: STRIP_DAYS }, (_, offset) => dateKey(addDays(parseDateKey(today), offset)));
