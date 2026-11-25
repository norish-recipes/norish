import { router } from "../../trpc";
import { listsProcedures } from "./lists";
import { listsSubscriptions } from "./subscriptions";

export const listsRouter = router({
  ...listsProcedures._def.procedures,
  ...listsSubscriptions._def.procedures,
});
