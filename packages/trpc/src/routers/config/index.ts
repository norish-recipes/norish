import { router } from "../../trpc";
import { configProcedures } from "./procedures";
import { configSubscriptions } from "./subscriptions";

export const configRouter = router({
  ...configProcedures._def.procedures,
  ...configSubscriptions._def.procedures,
});
