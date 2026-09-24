import { router } from "../../trpc";
import { groceriesProcedures } from "./groceries";
import { recurringGroceriesProcedures } from "./recurring";
import { groceriesSubscriptions } from "./subscriptions";

export const groceriesRouter = router({
  ...groceriesProcedures._def.procedures,
  ...recurringGroceriesProcedures._def.procedures,
  ...groceriesSubscriptions._def.procedures,
});
