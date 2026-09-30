import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { CatalogueActor, CatalogueRefusal } from "@norish/shared-server/ingredients/catalogue";
import type { ReviewReport } from "@norish/shared/contracts/ingredient-catalogue";
import { findCatalogueIngredientNames } from "@norish/db/repositories/ingredient-catalogue";
import { addIngredientReviewJob } from "@norish/queue/ingredient-review/producer";
import { findRunningReviewRound, readReviewReport } from "@norish/queue/ingredient-review/progress";
import { getQueues } from "@norish/queue/registry";
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
import { findParentWithAI, reviewFlaggedWithAI } from "@norish/shared-server/ingredients/review";
import {
  confirmSuggestion,
  dismissSuggestion,
  listSuggestions,
} from "@norish/shared-server/ingredients/suggestions";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { ingredients as ingredientsRealtime } from "@norish/shared-server/realtime/ingredients";
import {
  INGREDIENT_SEARCH_FIELDS,
  INGREDIENT_SEARCH_MATCHES,
} from "@norish/shared/lib/ingredient-search";

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
      /** Whether the text is contained in, or exactly, what it is matched against. */
      match: z.enum(INGREDIENT_SEARCH_MATCHES).optional(),
      /** Where to look: the name, the translations, the parent. */
      fields: z.array(z.enum(INGREDIENT_SEARCH_FIELDS)).min(1).max(3).optional(),
      flaggedOnly: z.boolean().optional(),
      /** Only the Ingredients filed under none: the top of the page's tree. */
      rootsOnly: z.boolean().optional(),
      /** Only the Ingredients with neither a parent nor kinds. */
      standaloneOnly: z.boolean().optional(),
      /** The viewer's locale: which spellings ride along with each row. */
      locale: z.string().max(20).optional(),
      cursor: z.number().int().min(0).nullish(),
    })
  )
  .query(async ({ ctx, input }) => {
    const page = await listIngredients(actorOf(ctx), {
      search: input.search,
      match: input.match,
      fields: input.fields,
      flaggedOnly: input.flaggedOnly,
      parentId: input.rootsOnly ? null : undefined,
      standaloneOnly: input.standaloneOnly,
      locale: input.locale,
      offset: input.cursor ?? 0,
    });

    return { items: page.items, nextCursor: page.nextOffset };
  });

/** The Ingredients that are kinds of one, as the page's tree folds them out under it. */
const kinds = authedProcedure
  .input(z.object({ parentId: z.uuid(), locale: z.string().max(20).optional() }))
  .query(async ({ ctx, input }) => {
    const page = await listIngredients(actorOf(ctx), {
      parentId: input.parentId,
      locale: input.locale,
    });

    return page.items;
  });

/**
 * One Ingredient as the page lists it, or null once it is gone: what an open
 * panel reads, so it stays current after a filter stops listing the food
 * (marking it distinct under "flagged only", say).
 */
const get = authedProcedure
  .input(z.object({ ingredientId: z.uuid(), locale: z.string().max(20).optional() }))
  .query(async ({ ctx, input }) => {
    const page = await listIngredients(actorOf(ctx), {
      id: input.ingredientId,
      locale: input.locale,
    });

    return page.items[0] ?? null;
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

      // A suggestion recorded, or a flag's reason brought up to date.
      if (outcome.outcome !== "not-flagged") await announceChanged([input.ingredientId]);

      return outcome;
    } catch (error) {
      if (error instanceof CatalogueEditError) {
        throw new TRPCError({ code: REFUSAL_CODES[error.refusal], message: error.refusal });
      }
      throw error;
    }
  });

/**
 * Ask AI what food an Ingredient is a kind of, and file it there on a sure
 * answer. Follows `edit` on the Ingredient. Answers what came of it.
 */
const findParentWithAI_ = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .mutation(async ({ ctx, input }) => {
    log.info(
      { userId: ctx.user.id, ingredientId: input.ingredientId },
      "Asking AI what an Ingredient is a kind of"
    );

    try {
      const outcome = await findParentWithAI(actorOf(ctx), input.ingredientId);

      await announceChanged([input.ingredientId]);

      return outcome;
    } catch (error) {
      if (error instanceof CatalogueEditError) {
        throw new TRPCError({ code: REFUSAL_CODES[error.refusal], message: error.refusal });
      }
      throw error;
    }
  });

/**
 * Ask AI about every flagged Ingredient on the page at once, or what food
 * each Ingredient on the page is a kind of (`mode: "parent"`): one job, a step
 * per food, that keeps going after the tab is closed. Each food's edit follows
 * `edit` on that food, checked by the round as it reaches it, so a food the
 * asker may not edit is passed over rather than refused here. Answers the job
 * the page watches the round by, over `onReview`.
 */
const reviewAllWithAI = authedProcedure
  .input(
    z.object({
      ingredientIds: z.array(z.uuid()).min(1).max(500),
      mode: z.enum(["review", "parent"]).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    log.info(
      { userId: ctx.user.id, count: input.ingredientIds.length, mode: input.mode ?? "review" },
      "Starting a round of Ask AI over Ingredients"
    );

    // The job carries each food's name, so the monitor's input reads as foods, not ids.
    const names = await findCatalogueIngredientNames(input.ingredientIds);
    const jobId = await addIngredientReviewJob(getQueues().ingredientReview, {
      ingredients: input.ingredientIds.map((id) => ({ id, name: names.get(id) ?? id })),
      ...(input.mode ? { mode: input.mode } : {}),
      actor: {
        userId: ctx.user.id,
        householdUserIds: ctx.householdUserIds ? [...ctx.householdUserIds] : null,
        isServerAdmin: ctx.isServerAdmin,
      },
    });

    return { jobId, total: input.ingredientIds.length };
  });

/** The round of Ask AI running on the instance, for a page that opens mid-round. */
const reviewRound = authedProcedure.query(() =>
  findRunningReviewRound(getQueues().ingredientReview)
);

/**
 * A round of Ask AI read back: what it did to each food and how, for the
 * summary the page offers once the round is over. Null once the queue has
 * let the job go.
 */
const reviewReport = authedProcedure
  .input(z.object({ jobId: z.string().min(1).max(100) }))
  .query(({ input }): Promise<ReviewReport | null> =>
    readReviewReport(getQueues().ingredientReview, input.jobId)
  );

/** Every suggestion AI left waiting on a person, and whether the viewer may answer each. */
const suggestions = authedProcedure.query(({ ctx }) => listSuggestions(actorOf(ctx)));

const suggestionIds = z.object({ suggestionIds: z.array(z.uuid()).min(1).max(500) });

/**
 * Answer suggestions one by one, confirming (the edit each proposes is made
 * as the viewer's own) or dismissing them. One that is refused or already
 * gone does not stop the rest; the answer counts both and names the first
 * refusal, for the page to say why.
 */
async function answerSuggestions(
  ctx: AuthedProcedureContext,
  ids: readonly string[],
  answer: typeof confirmSuggestion
): Promise<{ done: number; failed: number; refusal: CatalogueRefusal | null }> {
  const changed = new Set<string>();
  let done = 0;
  let refusal: CatalogueRefusal | null = null;

  for (const id of ids) {
    try {
      for (const ingredientId of await answer(actorOf(ctx), id)) changed.add(ingredientId);
      done += 1;
    } catch (error) {
      if (!(error instanceof CatalogueEditError)) throw error;
      refusal ??= error.refusal;
    }
  }
  if (changed.size > 0) await announceChanged([...changed]);

  return { done, failed: ids.length - done, refusal };
}

const confirmSuggestions = authedProcedure.input(suggestionIds).mutation(({ ctx, input }) => {
  log.info({ userId: ctx.user.id, count: input.suggestionIds.length }, "Confirming AI suggestions");

  return answerSuggestions(ctx, input.suggestionIds, confirmSuggestion);
});

const dismissSuggestions = authedProcedure.input(suggestionIds).mutation(({ ctx, input }) => {
  log.info({ userId: ctx.user.id, count: input.suggestionIds.length }, "Dismissing AI suggestions");

  return answerSuggestions(ctx, input.suggestionIds, dismissSuggestion);
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
  kinds,
  get,
  spellings,
  addAlias,
  rename,
  markDistinct,
  removeAlias,
  remove,
  reviewWithAI,
  findParentWithAI: findParentWithAI_,
  reviewAllWithAI,
  reviewRound,
  reviewReport,
  suggestions,
  confirmSuggestions,
  dismissSuggestions,
  merge,
  moveAlias,
  setParent,
  ...ingredientsSubscriptions._def.procedures,
});
