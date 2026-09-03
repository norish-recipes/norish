import { router } from "../../trpc";
import { cookbooksProcedures } from "./cookbooks";
import { cookbookMembershipProcedures } from "./membership";
import { cookbooksSubscriptions } from "./subscriptions";

export { cookbookEmitter } from "./emitter";
export type { CookbookSubscriptionEvents } from "./emitter";

export const cookbooksRouter = router({
  ...cookbooksProcedures._def.procedures,
  ...cookbookMembershipProcedures._def.procedures,
  ...cookbooksSubscriptions._def.procedures,
});
