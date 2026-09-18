import { listIngredientNames } from "@norish/db/repositories/ingredient-pictures";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * Every Ingredient Name (ADR-0037), for every signed-in reader.
 *
 * The editor's suggestions and the grocery list's pictures read it and match
 * names on the device, so suggestions cover every name and pictures work for
 * hand-typed groceries and offline. Recipe pages do not need it: their lines
 * carry their picture with them.
 */
const list = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting ingredient names");

  return { ingredients: await listIngredientNames() };
});

export const ingredientsRouter = router({
  list,
});
