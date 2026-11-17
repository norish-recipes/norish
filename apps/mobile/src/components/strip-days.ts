import { addDays, dateKey } from "@norish/shared/lib/helpers";

/** How many days the move strip shows, from today. */
export const STRIP_DAYS = 14;

/** The strip's days, today first. */
export const stripDays = (today: Date) =>
  Array.from({ length: STRIP_DAYS }, (_, offset) => addDays(today, offset));

/** Whether two dates fall on the same calendar day. */
export const sameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);
