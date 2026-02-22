import { router } from "../../trpc";

import { calendarSubscriptions } from "./subscriptions";
import { plannedItemsProcedures } from "./planned-items";

export { calendarEmitter } from "./emitter";
export type { CalendarSubscriptionEvents } from "./types";

export const calendarRouter = router({
  ...calendarSubscriptions._def.procedures,
  ...plannedItemsProcedures._def.procedures,
});
