import { router } from "../../trpc";
import { aisleProcedures } from "./aisles";
import { storeProductProcedures } from "./products";
import { storesProcedures } from "./stores";
import { storesSubscriptions } from "./subscriptions";

export const storesRouter = router({
  ...storesProcedures._def.procedures,
  ...storeProductProcedures._def.procedures,
  ...aisleProcedures._def.procedures,
  ...storesSubscriptions._def.procedures,
});
