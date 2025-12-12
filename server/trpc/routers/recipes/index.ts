import { router } from "../../trpc";

import { recipesProcedures } from "./recipes";
import { recipesSubscriptions } from "./subscriptions";
import { imagesProcedures } from "./images";
import { pendingProcedures } from "./pending";

export { recipeEmitter } from "./emitter";
export type { RecipeSubscriptionEvents } from "./types";

export const recipesRouter = router({
  ...recipesProcedures._def.procedures,
  ...recipesSubscriptions._def.procedures,
  ...imagesProcedures._def.procedures,
  ...pendingProcedures._def.procedures,
});
