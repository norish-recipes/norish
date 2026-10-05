import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { CatalogueActor, CatalogueRefusal } from "@norish/shared-server/ingredients/catalogue";
import type {
  ReviewReport,
  ReviewScopeSummary,
} from "@norish/shared/contracts/ingredient-catalogue";
import type {
  IngredientNutrition,
  NutritionFoodSummary,
} from "@norish/shared/contracts/ingredient-nutrition";
import type { SpoonMeasure } from "@norish/shared/lib/spoon-measure";
import { assertAIEnabled } from "@norish/auth/permissions";
import { findCatalogueIngredientNames } from "@norish/db/repositories/ingredient-catalogue";
import { addIngredientReviewJob } from "@norish/queue/ingredient-review/producer";
import {
  findRunningReviewRound,
  readReviewReport,
  readRoundTokens,
} from "@norish/queue/ingredient-review/progress";
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
  saveDraft as saveIngredientDraft,
  setParent as setCatalogueParent,
} from "@norish/shared-server/ingredients/catalogue";
import { announcingTogether, ingredientChanges } from "@norish/shared-server/ingredients/changes";
import {
  correctNutrition as correctHouseholdNutrition,
  NutritionCorrectionError,
  removeNutritionCorrection as removeHouseholdCorrection,
  searchDatasetFoods,
} from "@norish/shared-server/ingredients/nutrition/corrections";
import { resolveIngredientNutrition } from "@norish/shared-server/ingredients/nutrition/ingredient-nutrition";
import { spoonMeasureFor } from "@norish/shared-server/ingredients/nutrition/spoon-measure";
import { findIngredientFor } from "@norish/shared-server/ingredients/resolver";
import {
  estimateReviewTokens,
  findParentWithAI,
  listReviewableIngredients,
  reviewFlaggedWithAI,
} from "@norish/shared-server/ingredients/review";
import {
  confirmSuggestion,
  dismissSuggestion,
  inConfirmOrder,
  listSuggestions,
} from "@norish/shared-server/ingredients/suggestions";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { REVIEW_SCOPES } from "@norish/shared/contracts/ingredient-catalogue";
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
 * Run a catalogue call, turning a refusal into the error the page shows. The
 * message is the refusal itself, which the page translates.
 */
async function translated<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof CatalogueEditError) {
      throw new TRPCError({ code: REFUSAL_CODES[error.refusal], message: error.refusal });
    }
    throw error;
  }
}

/** Run a catalogue edit, which announces what it changed itself. */
async function asEditResult(run: () => Promise<unknown>): Promise<{ success: true }> {
  await translated(run);

  return { success: true };
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

    return asEditResult(() => addCatalogueAlias(actorOf(ctx), input.ingredientId, input.text));
  });

const rename = authedProcedure
  .input(z.object({ ingredientId: z.uuid(), name: ingredientName }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Renaming an Ingredient");

    return asEditResult(() => renameIngredient(actorOf(ctx), input.ingredientId, input.name));
  });

const markDistinct = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Marking distinct");

    return asEditResult(() => markCatalogueDistinct(actorOf(ctx), input.ingredientId));
  });

const removeAlias = authedProcedure
  .input(z.object({ aliasId: z.uuid() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, aliasId: input.aliasId }, "Removing an alias");

    return asEditResult(() => removeCatalogueAlias(actorOf(ctx), input.aliasId));
  });

/**
 * Ask AI what a Flagged Ingredient is, and act on a sure answer. Follows
 * `edit` on the Ingredient, and AI being on for the instance, as every AI
 * use does. Answers what came of it, for the page to say.
 */
const reviewWithAI = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .mutation(async ({ ctx, input }) => {
    await assertAIEnabled();
    log.info(
      { userId: ctx.user.id, ingredientId: input.ingredientId },
      "Asking AI about a flagged Ingredient"
    );

    return translated(async () => {
      const outcome = await reviewFlaggedWithAI(actorOf(ctx), input.ingredientId);

      // A suggestion recorded, or a flag's reason brought up to date.
      if (outcome.outcome !== "not-flagged") {
        await ingredientChanges().changed([input.ingredientId]);
      }

      return outcome;
    });
  });

/**
 * Ask AI what food an Ingredient is a kind of, and file it there on a sure
 * answer. Follows `edit` on the Ingredient. Answers what came of it.
 */
const findParentWithAI_ = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .mutation(async ({ ctx, input }) => {
    await assertAIEnabled();
    log.info(
      { userId: ctx.user.id, ingredientId: input.ingredientId },
      "Asking AI what an Ingredient is a kind of"
    );

    return translated(async () => {
      const outcome = await findParentWithAI(actorOf(ctx), input.ingredientId);

      // A suggestion recorded or cleared.
      await ingredientChanges().changed([input.ingredientId]);

      return outcome;
    });
  });

/** These Ingredients by id and by name, so the job monitor's input reads as foods, not ids. */
async function namedFoods(ids: readonly string[]): Promise<{ id: string; name: string }[]> {
  const names = await findCatalogueIngredientNames(ids);

  return ids.map((id) => ({ id, name: names.get(id) ?? id }));
}

/**
 * Ask AI about the flagged Ingredients the asker may edit, every one or only
 * those no suggestion waits on (`scope`), which the server picks, however
 * many there are; or what food each Ingredient on the page is a kind of
 * (`mode: "parent"`). One job, a step per food, that keeps going after the
 * tab is closed. Each food's edit follows `edit` on that food, checked again
 * by the round as it reaches it, so a food the asker may no longer edit is
 * passed over rather than refused here. Answers the job the page watches the
 * round by, over `onReview`, and the foods it waits on.
 */
const reviewAllWithAI = authedProcedure
  .input(
    z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("review"), scope: z.enum(REVIEW_SCOPES) }),
      z.object({ mode: z.literal("parent"), ingredientIds: z.array(z.uuid()).min(1) }),
    ])
  )
  .mutation(async ({ ctx, input }) => {
    await assertAIEnabled();

    const foods =
      input.mode === "review"
        ? (await listReviewableIngredients(actorOf(ctx), input.scope)).map(({ id, name }) => ({
            id,
            name,
          }))
        : await namedFoods(input.ingredientIds);

    log.info(
      {
        userId: ctx.user.id,
        count: foods.length,
        mode: input.mode,
        ...(input.mode === "review" ? { scope: input.scope } : {}),
      },
      "Starting a round of Ask AI over Ingredients"
    );
    if (foods.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing to ask AI about" });
    }

    const jobId = await addIngredientReviewJob(getQueues().ingredientReview, {
      ingredients: foods,
      mode: input.mode,
      actor: {
        userId: ctx.user.id,
        householdUserIds: ctx.householdUserIds ? [...ctx.householdUserIds] : null,
        isServerAdmin: ctx.isServerAdmin,
      },
    });

    return { jobId, total: foods.length, pending: foods.map((food) => food.id) };
  });

/**
 * What a round of Ask AI over the flagged Ingredients would ask about, for
 * the asker: how many each scope holds, and about how many tokens a food's
 * question takes. Measured over the latest finished round where the queue
 * still holds one that recorded its tokens; counted from the prompt
 * otherwise.
 */
const reviewScope = authedProcedure.query(async ({ ctx }): Promise<ReviewScopeSummary> => {
  await assertAIEnabled();

  const foods = await listReviewableIngredients(actorOf(ctx));
  const measured = await readRoundTokens(getQueues().ingredientReview);

  return {
    flagged: foods.length,
    unsuggested: foods.filter((food) => !food.suggested).length,
    tokens: measured
      ? { basis: "measured", ...measured }
      : { basis: "prompt", models: await estimateReviewTokens(foods.map((food) => food.name)) },
  };
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

/** The suggestions waiting on the viewer: only those about foods they may edit. */
const suggestions = authedProcedure.query(({ ctx }) => listSuggestions(actorOf(ctx)));

// As many as there are: Confirm all answers every suggestion a round over the catalogue left.
const suggestionIds = z.object({ suggestionIds: z.array(z.uuid()).min(1) });

/**
 * Answer suggestions one by one, confirming (the edit each proposes is made
 * as the viewer's own) or dismissing them, and announce what they changed
 * once, together. One that is refused does not stop the rest; the answer
 * counts them and names the first refusal, for the page to say why. One
 * already gone by its turn was settled another way, by an earlier answer in
 * the same go (two foods suggested into each other) or by someone else, and
 * is neither done nor refused.
 */
async function answerSuggestions(
  ctx: AuthedProcedureContext,
  ids: readonly string[],
  answer: typeof confirmSuggestion
): Promise<{ done: number; failed: number; refusal: CatalogueRefusal | null }> {
  return announcingTogether(async () => {
    let done = 0;
    let failed = 0;
    let refusal: CatalogueRefusal | null = null;

    for (const id of ids) {
      try {
        await answer(actorOf(ctx), id);
        done += 1;
      } catch (error) {
        if (!(error instanceof CatalogueEditError)) throw error;
        if (error.refusal === "not-found") continue;
        failed += 1;
        refusal ??= error.refusal;
      }
    }

    return { done, failed, refusal };
  });
}

const confirmSuggestions = authedProcedure.input(suggestionIds).mutation(async ({ ctx, input }) => {
  log.info({ userId: ctx.user.id, count: input.suggestionIds.length }, "Confirming AI suggestions");

  // A merge first would take away the food a merge into it names.
  return answerSuggestions(ctx, await inConfirmOrder(input.suggestionIds), confirmSuggestion);
});

const dismissSuggestions = authedProcedure.input(suggestionIds).mutation(({ ctx, input }) => {
  log.info({ userId: ctx.user.id, count: input.suggestionIds.length }, "Dismissing AI suggestions");

  return answerSuggestions(ctx, input.suggestionIds, dismissSuggestion);
});

/**
 * Save an Ingredient's draft from its panel as one edit: a new name, a new
 * parent (null clears it), spellings removed and added, each under its own
 * rule. A refusal anywhere changes nothing, and says why.
 */
const saveDraft = authedProcedure
  .input(
    z.object({
      ingredientId: z.uuid(),
      name: ingredientName.optional(),
      parentId: z.uuid().nullable().optional(),
      add: z.array(ingredientName).max(100),
      remove: z.array(z.uuid()).max(100),
    })
  )
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Saving an Ingredient");
    const { ingredientId, ...draft } = input;

    return asEditResult(() => saveIngredientDraft(actorOf(ctx), ingredientId, draft));
  });

/** Delete an Ingredient nothing uses. Follows `edit` on the Ingredient. */
const remove = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Deleting an Ingredient");

    return asEditResult(() => deleteIngredient(actorOf(ctx), input.ingredientId));
  });

/** Merge one Ingredient into another. Needs `edit` on both. */
const merge = authedProcedure
  .input(z.object({ sourceId: z.uuid(), targetId: z.uuid() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ...input }, "Merging Ingredients");

    return asEditResult(() => mergeIngredients(actorOf(ctx), input.sourceId, input.targetId));
  });

/** Move a spelling to another Ingredient, or to a new one (`targetId` null): the unmerge. */
const moveAlias = authedProcedure
  .input(z.object({ aliasId: z.uuid(), targetId: z.uuid().nullable() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ...input }, "Moving an alias");

    return asEditResult(() => moveCatalogueAlias(actorOf(ctx), input.aliasId, input.targetId));
  });

/** Set or clear an Ingredient's Parent Ingredient. Follows `edit` on the Ingredient. */
const setParent = authedProcedure
  .input(z.object({ ingredientId: z.uuid(), parentId: z.uuid().nullable() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ...input }, "Setting a Parent Ingredient");

    return asEditResult(() => setCatalogueParent(actorOf(ctx), input.ingredientId, input.parentId));
  });

/**
 * One Ingredient's nutrition as the viewer's household reads it (ADR-0039):
 * its numbers per 100 g, piece weight and density, each with where it came
 * from, or null once the Ingredient is gone.
 */
const nutrition = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .query(async ({ ctx, input }): Promise<IngredientNutrition | null> => {
    const answer = await resolveIngredientNutrition([input.ingredientId], {
      householdUserIds: ctx.userIds,
    });

    return answer.get(input.ingredientId) ?? null;
  });

/**
 * The nutrition of many Ingredients at once, as the viewer's household reads
 * it: what a recipe page works its total out from, in the browser, so the
 * total follows the recipe's lines as they are edited.
 */
const nutritionFor = authedProcedure
  .input(z.object({ ingredientIds: z.array(z.uuid()).max(500) }))
  .query(async ({ ctx, input }): Promise<Record<string, IngredientNutrition>> => {
    const answer = await resolveIngredientNutrition(input.ingredientIds, {
      householdUserIds: ctx.userIds,
    });

    return Object.fromEntries(answer);
  });

/**
 * The measure an Ingredient's spoon weight is shown and corrected in for the
 * viewer: the volume measure the recipes they can open use most for it, or
 * null where none measures it by volume (ADR-0039).
 */
const spoonMeasure = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .query(({ ctx, input }): Promise<SpoonMeasure | null> =>
    spoonMeasureFor(
      {
        userId: ctx.user.id,
        householdUserIds: ctx.householdUserIds,
        isServerAdmin: ctx.isServerAdmin,
      },
      input.ingredientId
    )
  );

/** A dataset food, as a correction names it. */
const datasetFood = z.object({
  food: z
    .string()
    .regex(/^[a-z0-9-]+:[^\s]+$/)
    .max(100),
});
const amount = z.number().finite().nonnegative().max(100_000);

/**
 * Correct an Ingredient's nutrition for the viewer's household: any member,
 * any Ingredient, no edit policy (a correction is the household's data, not
 * an edit to the Ingredient). Each fact is a dataset food, a number from a
 * label, or left to the sources (null).
 */
const correctNutrition = authedProcedure
  .input(
    z.object({
      ingredientId: z.uuid(),
      numbers: z
        .union([
          datasetFood,
          z.object({ kcal: amount, fat: amount, carbs: amount, protein: amount }),
        ])
        .nullable(),
      pieceWeight: z.union([datasetFood, z.object({ grams: amount.positive() })]).nullable(),
      density: z
        .union([datasetFood, z.object({ gramsPerMl: amount.positive().max(30) })])
        .nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Correcting nutrition");
    const { ingredientId, ...correction } = input;

    try {
      await correctHouseholdNutrition(memberOf(ctx), ingredientId, correction);
    } catch (error) {
      if (error instanceof NutritionCorrectionError) {
        throw new TRPCError({
          code: error.refusal === "not-found" ? "NOT_FOUND" : "BAD_REQUEST",
          message: error.refusal,
        });
      }
      throw error;
    }

    return { success: true as const };
  });

/** Remove the household's correction to an Ingredient: back to the datasets' numbers. */
const removeNutritionCorrection = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .mutation(async ({ ctx, input }) => {
    log.info(
      { userId: ctx.user.id, ingredientId: input.ingredientId },
      "Removing a nutrition correction"
    );
    await removeHouseholdCorrection(memberOf(ctx), input.ingredientId);

    return { success: true as const };
  });

/** Dataset foods whose names hold every word searched, for a correction to name. */
const nutritionFoods = authedProcedure
  .input(z.object({ search: z.string().trim().min(2).max(100) }))
  .query(({ input }): Promise<NutritionFoodSummary[]> => searchDatasetFoods(input.search));

function memberOf(ctx: AuthedProcedureContext) {
  return { userId: ctx.user.id, householdUserIds: ctx.userIds, householdKey: ctx.householdKey };
}

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
  saveDraft,
  remove,
  reviewWithAI,
  findParentWithAI: findParentWithAI_,
  reviewAllWithAI,
  reviewScope,
  reviewRound,
  reviewReport,
  suggestions,
  confirmSuggestions,
  dismissSuggestions,
  merge,
  moveAlias,
  setParent,
  nutrition,
  nutritionFor,
  spoonMeasure,
  correctNutrition,
  removeNutritionCorrection,
  nutritionFoods,
  ...ingredientsSubscriptions._def.procedures,
});
