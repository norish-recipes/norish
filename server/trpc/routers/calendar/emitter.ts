import type { CalendarSubscriptionEvents } from "./types";

import { createTypedEmitter } from "../../emitter";

export const calendarEmitter = createTypedEmitter<CalendarSubscriptionEvents>();
