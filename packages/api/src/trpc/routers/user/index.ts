import { router } from "../../trpc";

import { userProcedures } from "./user";
import { apiKeysProcedures } from "./api-keys";

export const userRouter = router({
  ...userProcedures._def.procedures,
  apiKeys: apiKeysProcedures,
});

export * from "./types";
