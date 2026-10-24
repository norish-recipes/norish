import { dateKey } from "@norish/shared/lib/helpers";

/** The cookie the browser keeps its IANA time zone in, so the server knows the reader's date. */
export const TIME_ZONE_COOKIE = "norish-tz";

/** `YYYY-MM-DD` of `now` in `timeZone`, or in this runtime's zone when that is missing or unknown. */
export function dateInTimeZone(now: Date, timeZone: string | undefined): string {
  return formatterFor(timeZone)?.format(now) ?? dateKey(now);
}

/** `timeZone` when this runtime knows it; undefined when it is missing or unknown. */
export function knownTimeZone(timeZone: string | undefined): string | undefined {
  return formatterFor(timeZone) ? timeZone : undefined;
}

function formatterFor(timeZone: string | undefined): Intl.DateTimeFormat | null {
  if (!timeZone) return null;

  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    // A zone this runtime doesn't know: a RangeError.
    return null;
  }
}
