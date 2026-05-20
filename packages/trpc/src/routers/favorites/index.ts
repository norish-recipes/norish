import { router } from "../../trpc";

import { favoritesProcedures } from "./favorites";

export const favoritesRouter = router({
  ...favoritesProcedures._def.procedures,
});
