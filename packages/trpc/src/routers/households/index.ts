import { router } from "../../trpc";

import { householdsRouter } from "./households";
import { householdSubscriptionsRouter } from "./subscriptions";

export { householdEmitter } from "./emitter";
export type { HouseholdSubscriptionEvents, HouseholdUserInfo } from "./types";

export const householdsAppRouter = router({
  ...householdsRouter._def.procedures,
  ...householdSubscriptionsRouter._def.procedures,
});
