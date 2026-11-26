import { TRPCError } from "@trpc/server";

import type { PantryIngredientDto, PantrySuggestionDto } from "@norish/shared/contracts";
import {
  deletePantryIngredient,
  listPantryIngredientsByHousehold,
  listPantrySuggestions,
  ownPantryIngredientExists,
} from "@norish/db/repositories/pantry";
import { addPickedToPantry, addToPantry } from "@norish/shared-server/ingredients/pantry";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { pantry } from "@norish/shared-server/realtime/pantry";
import {
  PantryIngredientAddSchema,
  PantryIngredientRemoveSchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

/** The household's Pantry in one round trip. */
const list = authedProcedure.query(async ({ ctx }): Promise<PantryIngredientDto[]> => {
  return listPantryIngredientsByHousehold(ctx.householdId);
});

/** The foods the household's own recipes use that its Pantry does not cover, most used first. */
const suggestions = authedProcedure.query(async ({ ctx }): Promise<PantrySuggestionDto[]> => {
  return listPantrySuggestions(ctx.householdId);
});

/**
 * Put a typed or picked food in the Pantry, announcing each item made, and answer the first's id:
 * the client's own for a food that was not there (ADR-0003), else the item the household has.
 */
const add = authedProcedure.input(PantryIngredientAddSchema).mutation(async ({ ctx, input }) => {
  const id = input.id ?? crypto.randomUUID();
  const actor = { userId: ctx.user.id, householdId: ctx.householdId };
  const items =
    "ingredientId" in input
      ? await addPickedToPantry(id, {
          ...actor,
          ingredientId: input.ingredientId,
          recipeIngredientId: input.recipeIngredientId,
        })
      : await addToPantry(id, { ...actor, name: input.name });
  const [first] = items;

  if (!first) {
    throw "ingredientId" in input
      ? new TRPCError({ code: "NOT_FOUND", message: "Ingredient not found" })
      : new TRPCError({ code: "BAD_REQUEST", message: "Names no food" });
  }

  for (const { item, created } of items) {
    if (!created) continue;
    log.info({ userId: ctx.user.id, pantryIngredientId: item.id }, "Pantry ingredient added");
    void pantry.publish("added", { item }, { householdId: ctx.householdId });
  }

  return first.item.id;
});

/** A Pantry Ingredient a procedure names is the household's own. */
async function assertPantryIngredientAccess(householdId: string, id: string): Promise<void> {
  if (!(await ownPantryIngredientExists(householdId, id))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Pantry ingredient not found" });
  }
}

/** Take a name out of the Pantry: any member of the household may. */
const remove = authedProcedure
  .input(PantryIngredientRemoveSchema)
  .mutation(async ({ ctx, input }) => {
    await assertPantryIngredientAccess(ctx.householdId, input.id);

    const removed = await deletePantryIngredient(input.id, ctx.householdId);

    if (removed) {
      log.info({ userId: ctx.user.id, pantryIngredientId: input.id }, "Pantry ingredient removed");
      void pantry.publish("removed", { itemId: input.id }, { householdId: ctx.householdId });
    }

    return input.id;
  });

export const pantryProcedures = router({
  list,
  suggestions,
  add,
  remove,
});
