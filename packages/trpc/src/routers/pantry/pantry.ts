import { TRPCError } from "@trpc/server";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  addPantryIngredient,
  deletePantryIngredient,
  getPantryIngredientOwnerId,
  listPantryIngredientsByUserIds,
} from "@norish/db/repositories/pantry";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { pantry } from "@norish/shared-server/realtime/pantry";
import {
  PantryIngredientAddSchema,
  PantryIngredientRemoveSchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

/** The household's Pantry, every member's items in one round trip. */
const list = authedProcedure.query(async ({ ctx }): Promise<PantryIngredientDto[]> => {
  return listPantryIngredientsByUserIds(ctx.userIds);
});

/**
 * Put a name in the Pantry. The name is folded by the repository, so "Olive
 * Oil" and " olive oil! " are one item; a name the household already has is
 * that item, and nothing is written or announced for it. Returns the item's
 * id, which is the client's own for a name that was not there (ADR-0003).
 */
const add = authedProcedure.input(PantryIngredientAddSchema).mutation(async ({ ctx, input }) => {
  const { item, created } = await addPantryIngredient(input.id ?? crypto.randomUUID(), {
    userId: ctx.user.id,
    userIds: ctx.userIds,
    name: input.name,
  });

  if (created) {
    log.info({ userId: ctx.user.id, pantryIngredientId: item.id }, "Pantry ingredient added");
    void pantry.publish("added", { item }, { householdKey: ctx.householdKey });
  }

  return item.id;
});

/** Take a name out of the Pantry: any member of the household may. */
const remove = authedProcedure
  .input(PantryIngredientRemoveSchema)
  .mutation(async ({ ctx, input }) => {
    const ownerId = await getPantryIngredientOwnerId(input.id);

    if (!ownerId)
      throw new TRPCError({ code: "NOT_FOUND", message: "Pantry ingredient not found" });
    await assertHouseholdAccess(ctx.user.id, ownerId);

    const removed = await deletePantryIngredient(input.id);

    if (removed) {
      log.info({ userId: ctx.user.id, pantryIngredientId: input.id }, "Pantry ingredient removed");
      void pantry.publish("removed", { itemId: input.id }, { householdKey: ctx.householdKey });
    }

    return input.id;
  });

export const pantryProcedures = router({
  list,
  add,
  remove,
});
