import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { CatalogueActor, CatalogueRefusal } from "@norish/shared-server/ingredients/catalogue";
import {
  addAlias as addCatalogueAlias,
  CatalogueEditError,
  deleteIngredient,
  listIngredients,
  listSpellings,
  markDistinct as markCatalogueDistinct,
  mergeIngredients,
  moveAlias as moveCatalogueAlias,
  removeAlias as removeCatalogueAlias,
  renameIngredient,
  setParent as setCatalogueParent,
} from "@norish/shared-server/ingredients/catalogue";
import { findIngredientFor } from "@norish/shared-server/ingredients/resolver";
import { reviewFlaggedWithAI } from "@norish/shared-server/ingredients/review";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { ingredients as ingredientsRealtime } from "@norish/shared-server/realtime/ingredients";

import type { AuthedProcedureContext } from "../../middleware";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { ingredientsSubscriptions } from "./subscriptions";

/**
 * The Ingredient a name Norish already knows resolves to, or null. A reader:
 * it never mints, so a grocery panel can ask what a Store remembers about a
 * name while it is still being typed (ADR-0037). Ingredients are always
 * visible, so the answer is nobody's in particular.
 */
const ingredientName = z.string().trim().min(1).max(300);

const find = authedProcedure
  .input(z.object({ name: ingredientName }))
  .query(async ({ input }): Promise<{ ingredientId: string } | null> => {
    const ingredient = await findIngredientFor(input.name);

    return ingredient ? { ingredientId: ingredient.ingredientId } : null;
  });

function actorOf(ctx: AuthedProcedureContext): CatalogueActor {
  return {
    userId: ctx.user.id,
    householdUserIds: ctx.householdUserIds,
    isServerAdmin: ctx.isServerAdmin,
  };
}

const REFUSAL_CODES: Record<CatalogueRefusal, TRPCError["code"]> = {
  forbidden: "FORBIDDEN",
  "not-found": "NOT_FOUND",
  "name-taken": "CONFLICT",
  "spelling-taken": "CONFLICT",
  "last-alias": "CONFLICT",
  "alias-in-use": "CONFLICT",
  "ingredient-in-use": "CONFLICT",
  "same-ingredient": "BAD_REQUEST",
  cycle: "CONFLICT",
  empty: "BAD_REQUEST",
};

/**
 * Run a catalogue edit, turning a refusal into the error the page shows. The
 * message is the refusal itself, which the page translates.
 */
async function asEditResult(run: () => Promise<unknown>): Promise<{ success: true }> {
  try {
    await run();
  } catch (error) {
    if (error instanceof CatalogueEditError) {
      throw new TRPCError({ code: REFUSAL_CODES[error.refusal], message: error.refusal });
    }
    throw error;
  }

  return { success: true };
}

/**
 * Tell every client that these Ingredients changed — what they are (a merge,
 * an alias move, a rename, a new parent, a deletion) or how the page shows
 * them (a spelling added or removed, a flag cleared) — so each refetches what
 * it derived from them. The edit has been written by now, so a failure to
 * tell is logged, never an error for an edit that went through.
 */
async function announceChanged(ingredientIds: string[]): Promise<void> {
  try {
    await ingredientsRealtime.publish("changed", { ingredientIds }, undefined);
  } catch (error) {
    log.warn({ err: error, ingredientIds }, "Could not announce an Ingredient change");
  }
}

/**
 * A page of the catalogue for the Ingredients page: every Ingredient, or the
 * flagged ones, or those a search finds, each saying what the viewer may do.
 * The cursor is where the page starts, for an infinite query.
 */
const list = authedProcedure
  .input(
    z.object({
      search: z.string().max(300).optional(),
      flaggedOnly: z.boolean().optional(),
      /** The viewer's locale: which spellings ride along with each row. */
      locale: z.string().max(20).optional(),
      cursor: z.number().int().min(0).nullish(),
    })
  )
  .query(async ({ ctx, input }) => {
    const page = await listIngredients(actorOf(ctx), {
      search: input.search,
      flaggedOnly: input.flaggedOnly,
      locale: input.locale,
      offset: input.cursor ?? 0,
    });

    return { items: page.items, nextCursor: page.nextOffset };
  });

/** Every spelling of one Ingredient, for a row that asked to see them all. */
const spellings = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .query(({ ctx, input }) => listSpellings(actorOf(ctx), input.ingredientId));

const addAlias = authedProcedure
  .input(z.object({ ingredientId: z.uuid(), text: ingredientName }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Adding an alias");

    return asEditResult(async () => {
      await addCatalogueAlias(actorOf(ctx), input.ingredientId, input.text);
      await announceChanged([input.ingredientId]);
    });
  });

const rename = authedProcedure
  .input(z.object({ ingredientId: z.uuid(), name: ingredientName }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Renaming an Ingredient");

    return asEditResult(async () => {
      await renameIngredient(actorOf(ctx), input.ingredientId, input.name);
      await announceChanged([input.ingredientId]);
    });
  });

const markDistinct = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Marking distinct");

    return asEditResult(async () => {
      await markCatalogueDistinct(actorOf(ctx), input.ingredientId);
      await announceChanged([input.ingredientId]);
    });
  });

const removeAlias = authedProcedure
  .input(z.object({ aliasId: z.uuid() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, aliasId: input.aliasId }, "Removing an alias");

    return asEditResult(async () => {
      const removed = await removeCatalogueAlias(actorOf(ctx), input.aliasId);

      await announceChanged([removed.ingredientId]);
    });
  });

/**
 * Ask AI what a Flagged Ingredient is, and act on a sure answer. Follows
 * `edit` on the Ingredient. Answers what came of it, for the page to say.
 */
const reviewWithAI = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .mutation(async ({ ctx, input }) => {
    log.info(
      { userId: ctx.user.id, ingredientId: input.ingredientId },
      "Asking AI about a flagged Ingredient"
    );

    try {
      const outcome = await reviewFlaggedWithAI(actorOf(ctx), input.ingredientId);

      if (outcome.outcome !== "not-flagged") await announceChanged([input.ingredientId]);

      return outcome;
    } catch (error) {
      if (error instanceof CatalogueEditError) {
        throw new TRPCError({ code: REFUSAL_CODES[error.refusal], message: error.refusal });
      }
      throw error;
    }
  });

/** Delete an Ingredient nothing uses. Follows `edit` on the Ingredient. */
const remove = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Deleting an Ingredient");

    return asEditResult(async () => {
      await deleteIngredient(actorOf(ctx), input.ingredientId);
      await announceChanged([input.ingredientId]);
    });
  });

/** Merge one Ingredient into another. Needs `edit` on both. */
const merge = authedProcedure
  .input(z.object({ sourceId: z.uuid(), targetId: z.uuid() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ...input }, "Merging Ingredients");

    return asEditResult(async () => {
      await mergeIngredients(actorOf(ctx), input.sourceId, input.targetId);
      await announceChanged([input.sourceId, input.targetId]);
    });
  });

/** Move a spelling to another Ingredient, or to a new one (`targetId` null): the unmerge. */
const moveAlias = authedProcedure
  .input(z.object({ aliasId: z.uuid(), targetId: z.uuid().nullable() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ...input }, "Moving an alias");

    return asEditResult(async () => {
      const moved = await moveCatalogueAlias(actorOf(ctx), input.aliasId, input.targetId);

      await announceChanged([moved.fromIngredientId, moved.ingredientId]);
    });
  });

/** Set or clear an Ingredient's Parent Ingredient. Follows `edit` on the Ingredient. */
const setParent = authedProcedure
  .input(z.object({ ingredientId: z.uuid(), parentId: z.uuid().nullable() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ...input }, "Setting a Parent Ingredient");

    return asEditResult(async () => {
      await setCatalogueParent(actorOf(ctx), input.ingredientId, input.parentId);
      await announceChanged([input.ingredientId]);
    });
  });

export const ingredientsRouter = router({
  find,
  list,
  spellings,
  addAlias,
  rename,
  markDistinct,
  removeAlias,
  remove,
  reviewWithAI,
  merge,
  moveAlias,
  setParent,
  ...ingredientsSubscriptions._def.procedures,
});
