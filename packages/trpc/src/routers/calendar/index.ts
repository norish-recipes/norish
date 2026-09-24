import { router } from "../../trpc";
import { plannedItemsProcedures } from "./planned-items";
import { calendarSubscriptions } from "./subscriptions";

export const calendarRouter = router({
  ...calendarSubscriptions._def.procedures,
  ...plannedItemsProcedures._def.procedures,
});
