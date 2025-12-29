import { router } from "../../trpc";

import { storesProcedures } from "./stores";
import { storesSubscriptions } from "./subscriptions";

export { storeEmitter } from "./emitter";
export type { StoreSubscriptionEvents } from "./types";

export const storesRouter = router({
  ...storesProcedures._def.procedures,
  ...storesSubscriptions._def.procedures,
});
