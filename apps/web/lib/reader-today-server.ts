import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { dateInTimeZone, knownTimeZone, TIME_ZONE_COOKIE } from "./reader-today";

/** The reader's time zone for this request, read once; undefined without a usable cookie. */
export const readReaderTimeZone = cache(async () =>
  knownTimeZone((await cookies()).get(TIME_ZONE_COOKIE)?.value)
);

/** The reader's date for this request, read once: the layout and the page seed the same day. */
export const readReaderToday = cache(async () =>
  dateInTimeZone(new Date(), await readReaderTimeZone())
);
