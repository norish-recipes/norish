import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { CatalogueRefusal } from "@norish/shared-server/ingredients/catalogue";
import type {
  IngredientNutrition,
  NutritionFoodSummary,
} from "@norish/shared/contracts/ingredient-nutrition";
import type { SpoonMeasure } from "@norish/shared/lib/spoon-measure";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { listIngredientUses } from "@norish/db/repositories/ingredient-catalogue";
import { markAIChangesCleared } from "@norish/db/repositories/users";
import { canDrawImages } from "@norish/shared-server/config/server-config-loader";
import {
  keepAIChange as keepCatalogueAIChange,
  listAIChangesFor,
  settleAIChanges as settleCatalogueAIChanges,
  undoAIChange as undoCatalogueAIChange,
} from "@norish/shared-server/ingredients/ai-changes";
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
import {
  generateIngredientIcon,
  uploadIngredientIcon,
} from "@norish/shared-server/ingredients/icon-drafts";
import { ingredientIconAddresses } from "@norish/shared-server/ingredients/icons";
import {
  correctNutrition as correctHouseholdNutrition,
  NutritionCorrectionError,
  removeNutritionCorrection as removeHouseholdCorrection,
  searchDatasetFoods,
} from "@norish/shared-server/ingredients/nutrition/corrections";
import { resolveIngredientNutrition } from "@norish/shared-server/ingredients/nutrition/ingredient-nutrition";
import { spoonMeasureFor } from "@norish/shared-server/ingredients/nutrition/spoon-measure";
import { findIngredientFor } from "@norish/shared-server/ingredients/resolver";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { ICON_FILE_PATTERN } from "@norish/shared-server/media/ingredient-icon";
import { ICON_PICTURE_MIME_TYPES } from "@norish/shared/contracts";
import {
  INGREDIENT_SEARCH_FIELDS,
  INGREDIENT_SEARCH_MATCHES,
} from "@norish/shared/lib/ingredient-search";

import type { AuthedProcedureContext } from "../../middleware";
import { formDataInputSchema, getFormDataString, getUploadedFile } from "../../form-data";
import { authedProcedure, viewerOf } from "../../middleware";
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

const REFUSAL_CODES: Record<CatalogueRefusal, TRPCError["code"]> = {
  forbidden: "FORBIDDEN",
  "not-found": "NOT_FOUND",
  "name-taken": "CONFLICT",
  "spelling-taken": "CONFLICT",
  "last-alias": "CONFLICT",
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
      /** Only the foods the page lists; the Pantry's search passes false to find hidden ones. */
      listedOnly: z.boolean().default(true),
      cursor: z.number().int().min(0).nullish(),
    })
  )
  .query(async ({ ctx, input }) => {
    const page = await listIngredients(viewerOf(ctx), {
      listedOnly: input.listedOnly,
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
    const page = await listIngredients(viewerOf(ctx), {
      parentId: input.parentId,
      listedOnly: true,
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
    const page = await listIngredients(viewerOf(ctx), {
      id: input.ingredientId,
      locale: input.locale,
    });

    return page.items[0] ?? null;
  });

/** Every spelling of one Ingredient, for a row that asked to see them all. */
const spellings = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .query(({ ctx, input }) => listSpellings(viewerOf(ctx), input.ingredientId));

/** Where an Ingredient is still used, for the panel a refused delete opens. */
const uses = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .query(({ ctx, input }) => listIngredientUses(viewerOf(ctx), input.ingredientId));

const addAlias = authedProcedure
  .input(z.object({ ingredientId: z.uuid(), text: ingredientName }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Adding an alias");

    return asEditResult(() => addCatalogueAlias(viewerOf(ctx), input.ingredientId, input.text));
  });

const rename = authedProcedure
  .input(z.object({ ingredientId: z.uuid(), name: ingredientName }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Renaming an Ingredient");

    return asEditResult(() => renameIngredient(viewerOf(ctx), input.ingredientId, input.name));
  });

const markDistinct = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Marking distinct");

    return asEditResult(() => markCatalogueDistinct(viewerOf(ctx), input.ingredientId));
  });

const removeAlias = authedProcedure
  .input(z.object({ aliasId: z.uuid() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, aliasId: input.aliasId }, "Removing an alias");

    return asEditResult(() => removeCatalogueAlias(viewerOf(ctx), input.aliasId));
  });

/** Every change Changed by AI lists, each saying whether the viewer may keep or undo it. */
const aiChanges = authedProcedure.query(({ ctx }) => listAIChangesFor(viewerOf(ctx)));

const aiChangeId = z.object({ changeId: z.uuid() });

/** Keep an unsure AI Change: the viewer's own decision about its food. Follows `edit` on the food. */
const keepAIChange = authedProcedure.input(aiChangeId).mutation(({ ctx, input }) => {
  log.info({ userId: ctx.user.id, changeId: input.changeId }, "Keeping an AI Change");

  return asEditResult(() => keepCatalogueAIChange(viewerOf(ctx), input.changeId));
});

/** Undo an AI Change, which AI then never makes again. Follows `edit` on the food. */
const undoAIChange = authedProcedure.input(aiChangeId).mutation(({ ctx, input }) => {
  log.info({ userId: ctx.user.id, changeId: input.changeId }, "Undoing an AI Change");

  return asEditResult(() => undoCatalogueAIChange(viewerOf(ctx), input.changeId));
});

/** Clear Changed by AI for the viewer: what is settled by now is no longer listed to them. */
const clearAIChanges = authedProcedure.mutation(async ({ ctx }) => {
  await markAIChangesCleared(ctx.user.id);

  return { success: true as const };
});

/** Keep all or Undo all: each change as its own Keep or Undo would, refused ones skipped. */
const settleAIChanges = authedProcedure
  .input(z.object({ changeIds: z.array(z.uuid()).max(5000), how: z.enum(["keep", "undo"]) }))
  .mutation(({ ctx, input }) => {
    log.info(
      { userId: ctx.user.id, how: input.how, count: input.changeIds.length },
      "Settling AI Changes"
    );

    return asEditResult(() => settleCatalogueAIChanges(viewerOf(ctx), input.changeIds, input.how));
  });

/**
 * Which Ingredient Icon each of these foods shows, by address, or null for
 * the placeholder: what every surface that names foods reads, once for all
 * the foods it shows. Ingredients are always visible, so the answer is
 * nobody's in particular.
 */
const icons = authedProcedure
  .input(z.object({ ids: z.array(z.uuid()).max(500) }))
  .query(async ({ input }): Promise<Record<string, string | null>> =>
    Object.fromEntries(await ingredientIconAddresses(input.ids))
  );

const ICON_PICTURE_TYPES: ReadonlySet<string> = new Set(ICON_PICTURE_MIME_TYPES);

/**
 * A picture uploaded in the Ingredient panel (FormData: `ingredientId`,
 * `image`), cut out to an icon and stored for the panel's draft, which Save
 * attaches. Follows `edit` on the Ingredient.
 */
const uploadIcon = authedProcedure.input(formDataInputSchema).mutation(async ({ ctx, input }) => {
  const ingredientId = z.uuid().safeParse(getFormDataString(input, "ingredientId"));
  const picture = getUploadedFile(input, "image");

  if (!ingredientId.success || !picture || !ICON_PICTURE_TYPES.has(picture.type)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Not a picture an icon is made from" });
  }
  if (picture.size > SERVER_CONFIG.MAX_IMAGE_FILE_SIZE) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "The picture is too large" });
  }
  log.info(
    { userId: ctx.user.id, ingredientId: ingredientId.data },
    "Uploading an Ingredient Icon"
  );
  const bytes = Buffer.from(await picture.arrayBuffer());

  return translated(() => uploadIngredientIcon(viewerOf(ctx), ingredientId.data, bytes));
});

/**
 * Draw a food's icon with the instance's image provider, in the request,
 * for the panel's draft, which Save attaches. Follows `edit` on the
 * Ingredient, and refused where nothing can draw.
 */
const generateIcon = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .mutation(async ({ ctx, input }) => {
    await assertCanDraw();
    log.info(
      { userId: ctx.user.id, ingredientId: input.ingredientId },
      "Generating an Ingredient Icon"
    );

    return translated(() => generateIngredientIcon(viewerOf(ctx), input.ingredientId));
  });

/** Refuse unless the instance can draw: AI on and an image provider configured. */
async function assertCanDraw(): Promise<void> {
  if (!(await canDrawImages())) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No image provider can draw" });
  }
}

/**
 * Save an Ingredient panel's draft as one edit (`saveDraft`); a refusal anywhere changes nothing,
 * and says why.
 */
const saveDraft = authedProcedure
  .input(
    z.object({
      ingredientId: z.uuid(),
      name: ingredientName.optional(),
      parentId: z.uuid().nullable().optional(),
      add: z.array(ingredientName).max(100),
      remove: z.array(z.uuid()).max(100),
      /** Of `remove`, those the person says name no food, for the junk pile. */
      junk: z.array(z.uuid()).max(100).default([]),
      icon: z.string().regex(ICON_FILE_PATTERN).nullable().optional(),
    })
  )
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Saving an Ingredient");
    const { ingredientId, ...draft } = input;

    return asEditResult(() => saveIngredientDraft(viewerOf(ctx), ingredientId, draft));
  });

/** Delete an Ingredient; its lines and Groceries keep their text. Follows `edit` on the Ingredient. */
const remove = authedProcedure
  .input(z.object({ ingredientId: z.uuid() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ingredientId: input.ingredientId }, "Deleting an Ingredient");

    return asEditResult(() => deleteIngredient(viewerOf(ctx), input.ingredientId));
  });

/** Merge one Ingredient into another. Needs `edit` on both. */
const merge = authedProcedure
  .input(z.object({ sourceId: z.uuid(), targetId: z.uuid() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ...input }, "Merging Ingredients");

    return asEditResult(() => mergeIngredients(viewerOf(ctx), input.sourceId, input.targetId));
  });

/** Move a spelling to another Ingredient, or to a new one (`targetId` null): the unmerge. */
const moveAlias = authedProcedure
  .input(z.object({ aliasId: z.uuid(), targetId: z.uuid().nullable() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ...input }, "Moving an alias");

    return asEditResult(() => moveCatalogueAlias(viewerOf(ctx), input.aliasId, input.targetId));
  });

/** Set or clear an Ingredient's Parent Ingredient. Follows `edit` on the Ingredient. */
const setParent = authedProcedure
  .input(z.object({ ingredientId: z.uuid(), parentId: z.uuid().nullable() }))
  .mutation(({ ctx, input }) => {
    log.info({ userId: ctx.user.id, ...input }, "Setting a Parent Ingredient");

    return asEditResult(() =>
      setCatalogueParent(viewerOf(ctx), input.ingredientId, input.parentId)
    );
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
    spoonMeasureFor(viewerOf(ctx), input.ingredientId)
  );

/** A dataset food, as a correction names it. */
const datasetFood = z.object({
  food: z
    .string()
    .regex(/^[a-z0-9-]+:[^\s]+$/)
    .max(100),
});
const amount = z.number().nonnegative().max(100_000);

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
  uses,
  addAlias,
  rename,
  markDistinct,
  removeAlias,
  icons,
  uploadIcon,
  generateIcon,
  saveDraft,
  remove,
  aiChanges,
  keepAIChange,
  undoAIChange,
  settleAIChanges,
  clearAIChanges,
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
