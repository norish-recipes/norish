import { router } from "../../trpc";

import { siteAuthTokensProcedures } from "./procedures";

export const siteAuthTokensRouter = router({
  ...siteAuthTokensProcedures._def.procedures,
});
