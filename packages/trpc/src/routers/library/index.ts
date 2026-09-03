import { router } from "../../trpc";
import { libraryProcedures } from "./library";

export const libraryRouter = router({
  ...libraryProcedures._def.procedures,
});
