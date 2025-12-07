import type { CalendarSubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use globalThis to persist across HMR in development
declare global {
  var __calendarEmitter__: TypedEmitter<CalendarSubscriptionEvents> | undefined;
}

export const calendarEmitter =
  globalThis.__calendarEmitter__ ||
  (globalThis.__calendarEmitter__ = createTypedEmitter<CalendarSubscriptionEvents>());
