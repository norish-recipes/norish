import { z } from "zod";

import { findIngredientFor } from "@norish/shared-server/ingredients/resolver";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * The Ingredient a name Norish already knows resolves to, or null. A reader:
 * it never mints, so a grocery panel can ask what a Store remembers about a
 * name while it is still being typed (ADR-0037). Ingredients are always
 * visible, so the answer is nobody's in particular.
 */
const find = authedProcedure
  .input(z.object({ name: z.string().trim().min(1).max(300) }))
  .query(async ({ input }): Promise<{ ingredientId: string } | null> => {
    const ingredient = await findIngredientFor(input.name);

    return ingredient ? { ingredientId: ingredient.ingredientId } : null;
  });

export const ingredientsRouter = router({ find });
