import { router } from "../../trpc";
import { imagesProcedures } from "./images";
import { pendingProcedures } from "./pending";
import { recipesProcedures } from "./recipes";
import { recipeSharesProcedures } from "./shares";
import { recipesSubscriptions } from "./subscriptions";
import { videosProcedures } from "./videos";

export { recipeEmitter } from "./emitter";
export type { RecipeSubscriptionEvents } from "./types";

export const recipesRouter = router({
  ...recipesProcedures._def.procedures,
  ...recipeSharesProcedures._def.procedures,
  ...recipesSubscriptions._def.procedures,
  ...imagesProcedures._def.procedures,
  ...videosProcedures._def.procedures,
  ...pendingProcedures._def.procedures,
});
