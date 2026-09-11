import { router } from "../../trpc";
import { pantryProcedures } from "./pantry";
import { pantrySubscriptions } from "./subscriptions";

export const pantryRouter = router({
  ...pantryProcedures._def.procedures,
  ...pantrySubscriptions._def.procedures,
});
