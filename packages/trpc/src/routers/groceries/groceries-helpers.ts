import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { CreatedGroceries } from "@norish/db";
import type { DbTransaction } from "@norish/db/drizzle";
import type { IngredientRef } from "@norish/db/repositories/ingredient-aliases";
import type {
  GroceryIngredientColumns,
  GroceryName,
} from "@norish/shared-server/ingredients/groceries";
import type { GroceryDto, GroceryUpdateDto } from "@norish/shared/contracts";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  assignGroceryToStore,
  createGroceries,
  deleteGroceryByIds,
  getGroceriesByIds,
  getGroceryHouseholdIds,
  getRecipeInfoForGroceries,
  GroceryCreateSchema,
  GroceryDeleteSchema,
  GroceryToggleSchema,
  GroceryUpdateBaseSchema,
  listGroceriesByHousehold,
  lockGroceryList,
  updateGroceries,
} from "@norish/db";
import { withTransaction } from "@norish/db/drizzle";
import {
  getRecurringGroceryHouseholdId,
  listRecurringGroceriesByHousehold,
} from "@norish/db/repositories/recurring-groceries";
import {
  findBestIngredientStorePreference,
  upsertIngredientStorePreference,
} from "@norish/db/repositories/stores";
import {
  groceryParts,
  ingredientColumns,
  resolveGroceryNames,
} from "@norish/shared-server/ingredients/groceries";
import { writeResolved } from "@norish/shared-server/ingredients/resolver";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { groceries } from "@norish/shared-server/realtime/groceries";
import { AssignGroceryToStoreInputSchema } from "@norish/shared/contracts/zod";

import { afterCommit } from "../../after-commit";
import { noticeGroceries } from "../stores/pricing";
import { assertStoreAccess } from "../stores/stores-helpers";

export type GroceryProcedureContext = {
  user: { id: string };
  householdId: string;
};

/**
 * Remember the Store a member sent a grocery's Ingredient to, so the household's next
 * line of that food goes there too. A line with no Ingredient yet (added
 * offline, or nameless), or sent to no Store, teaches nothing.
 */
export async function rememberStorePreference(
  householdId: string,
  userId: string,
  ingredientId: string | null | undefined,
  storeId: string | null | undefined
): Promise<void> {
  if (!ingredientId || !storeId) return;
  await upsertIngredientStorePreference(householdId, userId, ingredientId, storeId);
  log.debug({ userId, ingredientId, storeId }, "Saved ingredient store preference");
}

/** The ids among these that still exist, once every one is the household's own. */
export async function groceriesOfHousehold(
  ctx: Pick<GroceryProcedureContext, "householdId">,
  groceryIds: string[]
): Promise<Set<string>> {
  const householdIds = await getGroceryHouseholdIds(groceryIds);

  for (const householdId of householdIds.values()) {
    assertHouseholdAccess(ctx.householdId, householdId);
  }

  return new Set(householdIds.keys());
}

/** A recurring grocery a procedure names is the household's own. */
export async function assertRecurringAccess(
  ctx: Pick<GroceryProcedureContext, "householdId">,
  recurringGroceryId: string
): Promise<void> {
  const householdId = await getRecurringGroceryHouseholdId(recurringGroceryId);

  if (!householdId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Recurring grocery not found" });
  }
  assertHouseholdAccess(ctx.householdId, householdId);
}

type GroceryMergeCandidate = {
  id: string;
  name: string | null;
  unit: string | null;
  amount: number | null;
  purchaseAmount?: number | null;
  isDone: boolean;
  recipeIngredientId: string | null;
  recurringGroceryId: string | null;
  storeId: string | null;
  sortOrder: number;
};

/**
 * The grocery a rename or detach edits, written first in the transaction that adds its name's other
 * foods, under its name's food. `write` answers null where the edit is stale; nothing is written.
 */
export interface GroceryEdit {
  name: GroceryName;
  write: (ingredient: GroceryIngredientColumns, tx: DbTransaction) => Promise<GroceryDto | null>;
}

/** A split name's other foods, added as typed groceries with the edited line's amount and unit. */
export function otherFoods(
  others: ReadonlyArray<{ name: string }>,
  line: { quantity: number | null; unitOfMeasure: string | null },
  recipeIngredientId: string | null = null
): Array<z.infer<typeof GroceryCreateSchema>> {
  return others.map(({ name }) => ({
    name,
    amount: line.quantity,
    unit: line.unitOfMeasure,
    isDone: false,
    recipeIngredientId,
  }));
}

/** The key two list lines are merged under; not the Product Link's folding. */
function normalizeForMerge(name: string | null): string {
  return (name ?? "").toLowerCase().trim();
}

export async function listGroceriesData(ctx: GroceryProcedureContext) {
  log.debug({ userId: ctx.user.id }, "Listing groceries");

  const [groceries, recurringGroceries] = await Promise.all([
    listGroceriesByHousehold(ctx.householdId),
    listRecurringGroceriesByHousehold(ctx.householdId),
  ]);

  const recipeIngredientIds = groceries
    .map((grocery) => grocery.recipeIngredientId)
    .filter((id): id is string => id !== null);

  const recipeInfoMap = await getRecipeInfoForGroceries(recipeIngredientIds, ctx.householdId);
  const recipeMap: Record<string, { recipeId: string; recipeName: string }> = {};

  for (const [key, value] of recipeInfoMap) {
    recipeMap[key] = value;
  }

  log.debug(
    {
      userId: ctx.user.id,
      groceryCount: groceries.length,
      recurringCount: recurringGroceries.length,
      recipeMapSize: Object.keys(recipeMap).length,
    },
    "Groceries listed"
  );

  return { groceries, recurringGroceries, recipeMap };
}

export async function createGroceriesData(
  ctx: GroceryProcedureContext,
  input: Array<z.infer<typeof GroceryCreateSchema>>,
  edit?: GroceryEdit
) {
  // A line from a recipe only while the household may view that recipe; else as if it were gone.
  const fromRecipes = [
    ...new Set(input.flatMap((g) => (g.recipeIngredientId ? [g.recipeIngredientId] : []))),
  ];
  const viewable = await getRecipeInfoForGroceries(fromRecipes, ctx.householdId);

  if (fromRecipes.some((lineId) => !viewable.has(lineId))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
  }

  // An edit with no other foods has nothing to merge into.
  const existingGroceries =
    input.length > 0 ? await listGroceriesByHousehold(ctx.householdId, { includeDone: false }) : [];
  const existingByKey = new Map<string, GroceryMergeCandidate>();

  for (const grocery of existingGroceries) {
    const normalizedName = normalizeForMerge(grocery.name);

    // The grocery an edit renames is not merged into under the name it is losing.
    if (normalizedName && !grocery.isDone && grocery.id !== edit?.name.groceryId) {
      const recipeKey = grocery.recipeIngredientId ?? "manual";
      const recurringKey = grocery.recurringGroceryId ?? "none";
      const key = `${normalizedName}|${recipeKey}|${recurringKey}`;

      if (!existingByKey.has(key)) {
        existingByKey.set(key, grocery);
      }
    }
  }

  const groceriesToCreate: Array<{
    id: string;
    groceries: {
      householdId: string;
      userId: string;
      name: string | null;
      ingredientAliasId?: string | null;
      ingredientId?: string | null;
      unit: string | null;
      amount: number | null;
      purchaseAmount?: number | null;
      isDone: boolean;
      recipeIngredientId: string | null;
      recurringGroceryId: string | null;
      storeId: string | null;
    };
  }> = [];
  const groceriesToUpdate: Array<{ id: string; amount: number | null; storeId?: string | null }> =
    [];
  const returnIds: string[] = [];

  // A Store the client files a grocery under is the household's own; the
  // grocery is priced through it, and another household's Store is not a
  // heading here.
  const named = new Set(input.map((grocery) => grocery.storeId).filter((id): id is string => !!id));

  for (const storeId of named) await assertStoreAccess(ctx, storeId);
  // So is a recurring grocery it says the line repeats.
  const repeating = new Set(input.flatMap((grocery) => grocery.recurringGroceryId ?? []));

  for (const recurringGroceryId of repeating) await assertRecurringAccess(ctx, recurringGroceryId);

  // A Grocery names one food: a name whose words join foods is a grocery per food, merged alone.
  for (const grocery of (await groceryParts(input)).flat()) {
    const normalizedName = normalizeForMerge(grocery.name);
    const recipeKey = grocery.recipeIngredientId ?? "manual";
    const recurringKey = grocery.recurringGroceryId ?? "none";
    const lookupKey = normalizedName ? `${normalizedName}|${recipeKey}|${recurringKey}` : null;
    const existing = lookupKey ? existingByKey.get(lookupKey) : null;

    const shouldMerge =
      existing &&
      existing.purchaseAmount == null &&
      grocery.purchaseAmount == null &&
      (existing.unit === grocery.unit || (!existing.unit && !grocery.unit));

    if (shouldMerge && existing) {
      const existingAmount = existing.amount ?? 1;
      const newAmount = grocery.amount ?? 1;
      const mergedAmount = existingAmount + newAmount;

      const mergedStoreId = grocery.storeId ?? existing.storeId;

      groceriesToUpdate.push({
        id: existing.id,
        amount: mergedAmount,
        storeId: mergedStoreId,
      });
      returnIds.push(existing.id);
      existingByKey.set(lookupKey!, {
        ...existing,
        amount: mergedAmount,
        storeId: mergedStoreId,
      });
      continue;
    }

    const id = grocery.id ?? crypto.randomUUID();
    const storeId: string | null = grocery.storeId ?? null;

    groceriesToCreate.push({
      id,
      groceries: {
        householdId: ctx.householdId,
        userId: ctx.user.id,
        name: grocery.name,
        unit: grocery.unit,
        amount: grocery.amount,
        purchaseAmount: grocery.purchaseAmount,
        isDone: grocery.isDone ?? false,
        recipeIngredientId: grocery.recipeIngredientId ?? null,
        recurringGroceryId: grocery.recurringGroceryId ?? null,
        storeId,
      },
    });
    returnIds.push(id);

    if (lookupKey) {
      existingByKey.set(lookupKey, {
        id,
        name: grocery.name,
        unit: grocery.unit,
        amount: grocery.amount,
        purchaseAmount: grocery.purchaseAmount,
        isDone: false,
        recipeIngredientId: grocery.recipeIngredientId ?? null,
        recurringGroceryId: null,
        storeId,
        sortOrder: 0,
      });
    }
  }

  // Each new line's name is resolved to an Ingredient Alias, the way the
  // household's recipe lines are (ADR-0037). A merged line keeps its own.
  const fileNewLines = async (aliases: Array<IngredientRef | null>) => {
    for (const [index, { groceries: grocery }] of groceriesToCreate.entries()) {
      const alias = aliases[index];

      grocery.ingredientAliasId = alias?.aliasId ?? null;
      grocery.ingredientId = alias?.ingredientId ?? null;

      // A line added without a Store goes where the household sends its food.
      if (!grocery.storeId && alias && grocery.name) {
        const match = await findBestIngredientStorePreference(ctx.householdId, {
          id: alias.ingredientId,
          name: grocery.name,
        });

        grocery.storeId = match?.preference.storeId ?? null;
      }
    }
  };

  // One transaction writes the edit, the merges and the new lines, the list locked first.
  const written = await writeResolved(
    () =>
      resolveGroceryNames(
        [
          ...groceriesToCreate.map(({ groceries: grocery }) => grocery),
          ...(edit ? [edit.name] : []),
        ],
        { userId: ctx.user.id }
      ),
    async (aliases) => {
      await fileNewLines(aliases);

      return await withTransaction(async (tx) => {
        await lockGroceryList(tx, ctx.householdId);

        // The edit's name was resolved last.
        const edited = edit && (await edit.write(ingredientColumns(aliases.at(-1)), tx));
        const noneMade: CreatedGroceries = { created: [], shifted: [] };

        // A stale edit wrote nothing, and its other foods are not written either.
        if (edited === null) return { edited, merged: [], made: noneMade };

        return {
          edited,
          merged:
            groceriesToUpdate.length > 0
              ? await updateGroceries(groceriesToUpdate, ctx.householdId, tx)
              : [],
          made:
            groceriesToCreate.length > 0
              ? await createGroceries(groceriesToCreate, ctx.householdId, tx)
              : noneMade,
        };
      });
    }
  );
  const { edited, merged, made } = written;
  const editedRows = edited ? [edited] : [];
  let updatedGroceries: GroceryDto[] = [...editedRows, ...merged];
  const createdGroceries: GroceryDto[] = made.created;

  if (merged.length > 0) {
    log.info({ userId: ctx.user.id, count: merged.length }, "Groceries merged");
  }

  if (updatedGroceries.length > 0) {
    void groceries.publish(
      "updated",
      {
        changedGroceries: updatedGroceries,
      },
      { householdId: ctx.householdId }
    );
  }

  if (createdGroceries.length > 0) {
    log.info({ userId: ctx.user.id, count: createdGroceries.length }, "Groceries created");
    void groceries.publish(
      "created",
      {
        groceries: createdGroceries,
      },
      { householdId: ctx.householdId }
    );
  }

  // Making room at the top moved every active sibling's sort order, so the
  // shifted rows ride back on the answer and out to the household as an
  // update; a row merged and then shifted is reported as the shift left it.
  if (made.shifted.length > 0) {
    const shiftedIds = new Set(made.shifted.map((grocery) => grocery.id));

    updatedGroceries = [
      ...updatedGroceries.filter((grocery) => !shiftedIds.has(grocery.id)),
      ...made.shifted,
    ];
    void groceries.publish(
      "updated",
      {
        changedGroceries: made.shifted,
      },
      { householdId: ctx.householdId }
    );
  }

  const groceriesById = new Map<string, GroceryDto>();

  for (const grocery of [...updatedGroceries, ...createdGroceries]) {
    groceriesById.set(grocery.id, grocery);
  }

  const returnedGroceries = returnIds
    .map((id) => groceriesById.get(id))
    .filter((grocery): grocery is GroceryDto => grocery !== undefined);

  // A name the Store already knows is priced in this same response, with no
  // outbound request; a name it does not goes to the lookup queue, so adding
  // six things in a row stays as fast as it was. An edited name asks anew.
  const prices =
    (await afterCommit(ctx, "pricing groceries", () =>
      noticeGroceries(ctx, [...editedRows, ...returnedGroceries])
    )) ?? [];

  return {
    edited,
    ids: returnIds,
    createdGroceries,
    updatedGroceries,
    returnedGroceries,
    prices,
  };
}

export async function toggleGroceriesData(
  ctx: GroceryProcedureContext,
  input: z.infer<typeof GroceryToggleSchema>,
  { rejectMissing = false } = {}
) {
  const { groceries: toggles, isDone } = input;
  const groceryIds = toggles.map((grocery) => grocery.id);
  const versionById = new Map(toggles.map((grocery) => [grocery.id, grocery.version]));

  log.debug({ userId: ctx.user.id, count: groceryIds.length, isDone }, "Toggling groceries");

  // A line another member deleted lost to an earlier write: it is left out and answers stale.
  const present = await groceriesOfHousehold(ctx, groceryIds);

  if (rejectMissing && present.size !== groceryIds.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Some groceries not found" });
  }

  const existingGroceries =
    present.size > 0 ? await getGroceriesByIds([...present], ctx.householdId) : [];

  const updatedGroceries = existingGroceries.map((grocery) => ({
    ...grocery,
    version: versionById.get(grocery.id) ?? grocery.version,
    isDone,
  }));

  const parsed = z.array(GroceryUpdateBaseSchema).safeParse(updatedGroceries);

  if (!parsed.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid data" });
  }

  const updated =
    parsed.data.length > 0
      ? await updateGroceries(parsed.data as GroceryUpdateDto[], ctx.householdId)
      : [];

  if (updated.length !== groceryIds.length) {
    log.info(
      {
        userId: ctx.user.id,
        requestedCount: groceryIds.length,
        updatedCount: updated.length,
      },
      updated.length === 0
        ? "Stale grocery toggle; requesting client refresh"
        : "Grocery toggle partially applied due to stale versions; requesting client refresh"
    );
    void groceries.publish(
      "stale",
      {
        reason: "Groceries were updated elsewhere",
      },
      { householdId: ctx.householdId }
    );
  }

  log.debug({ userId: ctx.user.id, count: updated.length, isDone }, "Groceries toggled");

  if (updated.length > 0) {
    void groceries.publish(
      "updated",
      {
        changedGroceries: updated,
      },
      { householdId: ctx.householdId }
    );
  }

  return updated;
}

export async function deleteGroceriesData(
  ctx: GroceryProcedureContext,
  input: z.infer<typeof GroceryDeleteSchema>,
  { rejectMissing = false } = {}
) {
  const groceryIds = input.groceries.map((grocery) => grocery.id);

  log.info({ userId: ctx.user.id, count: groceryIds.length }, "Deleting groceries");

  // A line already gone is a delete that already happened: it is skipped, not stale.
  const present = await groceriesOfHousehold(ctx, groceryIds);

  if (rejectMissing && present.size !== groceryIds.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Some groceries not found" });
  }

  const result = await deleteGroceryByIds(
    input.groceries.filter((grocery) => present.has(grocery.id)),
    ctx.householdId
  );

  if (result.staleIds.length > 0) {
    log.info(
      { userId: ctx.user.id, staleGroceryIds: result.staleIds },
      "Stale grocery delete mutations; requesting client refresh"
    );
    void groceries.publish(
      "stale",
      {
        reason: "Groceries were updated elsewhere",
      },
      { householdId: ctx.householdId }
    );
  }

  if (result.deletedIds.length > 0) {
    log.info({ userId: ctx.user.id, count: result.deletedIds.length }, "Groceries deleted");
    void groceries.publish(
      "deleted",
      { groceryIds: result.deletedIds },
      { householdId: ctx.householdId }
    );
  }

  return result;
}

export async function assignGroceryToStoreData(
  ctx: GroceryProcedureContext,
  input: z.infer<typeof AssignGroceryToStoreInputSchema>,
  { rejectMissing = false } = {}
) {
  const { groceryId, storeId, savePreference, version } = input;

  log.debug({ userId: ctx.user.id, groceryId, storeId }, "Assigning grocery to store");

  // A line another member deleted lost to an earlier write: stale, as a changed version is.
  const exists = (await groceriesOfHousehold(ctx, [groceryId])).has(groceryId);

  if (rejectMissing && !exists) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Grocery not found" });
  }
  if (storeId) await assertStoreAccess(ctx, storeId);

  const updated = exists
    ? await assignGroceryToStore(groceryId, storeId, ctx.householdId, version)
    : null;

  if (!updated) {
    log.info(
      { userId: ctx.user.id, groceryId, storeId, version },
      "Stale grocery assign-to-store; requesting client refresh"
    );
    void groceries.publish(
      "stale",
      {
        reason: "Grocery was updated elsewhere",
      },
      { householdId: ctx.householdId }
    );

    return null;
  }

  log.info({ userId: ctx.user.id, groceryId, storeId }, "Grocery assigned to store");

  // Moving a grocery to another Store asks that Store a new question; the old
  // Store's answer was never about this one.
  await afterCommit(ctx, "pricing and remembering the Store", async () => {
    await noticeGroceries(ctx, [updated]);
    if (savePreference) {
      await rememberStorePreference(ctx.householdId, ctx.user.id, updated.ingredientId, storeId);
    }
  });

  void groceries.publish(
    "updated",
    {
      changedGroceries: [updated],
    },
    { householdId: ctx.householdId }
  );

  return updated;
}
