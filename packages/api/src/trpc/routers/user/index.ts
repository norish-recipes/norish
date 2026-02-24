import { router } from "../../trpc";
import { apiKeysProcedures } from "./api-keys";
import { userProcedures } from "./user";

export const userRouter = router({
  ...userProcedures._def.procedures,
  apiKeys: apiKeysProcedures,
});

export * from "./types";
