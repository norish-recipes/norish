import { router } from "../../trpc";

import { configProcedures } from "./procedures";

export const configRouter = router({
  ...configProcedures._def.procedures,
});
