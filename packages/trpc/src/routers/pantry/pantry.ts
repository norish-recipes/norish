import { TRPCError } from "@trpc/server";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  createPantryIngredient,
  deletePantryIngredient,
  findPantryIngredientInHousehold,
  getPantryIngredientOwnerId,
  listPantryIngredientsByUserIds,
} from "@norish/db/repositories/pantry";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { pantry } from "@norish/shared-server/realtime/pantry";
import {
  PantryIngredientAddSchema,
  PantryIngredientRemoveSchema,
} from "@norish/shared/contracts/zod";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

/** The household's Pantry, every member's items in one round trip. */
const list = authedProcedure.query(async ({ ctx }): Promise<PantryIngredientDto[]> => {
  return listPantryIngredientsByUserIds(ctx.userIds);
});

/**
 * Put a name in the Pantry. The name is folded here, so "Olive Oil" and
 * " olive oil! " are one item; a name the household already has is that
 * item, and nothing is written or announced for it. Returns the item's id.
 */
const add = authedProcedure.input(PantryIngredientAddSchema).mutation(async ({ ctx, input }) => {
  const normalizedName = normalizeGroceryName(input.name);

  if (!normalizedName) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A pantry ingredient needs a name" });
  }

  const existing = await findPantryIngredientInHousehold(ctx.userIds, normalizedName);

  if (existing) return existing.id;

  const item = await createPantryIngredient(input.id ?? crypto.randomUUID(), {
    userId: ctx.user.id,
    name: input.name,
  });

  log.info({ userId: ctx.user.id, pantryIngredientId: item.id }, "Pantry ingredient added");
  void pantry.publish("added", { item }, { householdKey: ctx.householdKey });

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
