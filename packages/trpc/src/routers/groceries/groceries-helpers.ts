import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { GroceryDto, GroceryUpdateDto } from "@norish/shared/contracts";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  assignGroceryToStore,
  createGroceries,
  deleteGroceryByIds,
  getGroceriesByIds,
  getGroceryOwnerIds,
  getRecipeInfoForGroceries,
  GroceryCreateSchema,
  GroceryDeleteSchema,
  GroceryToggleSchema,
  GroceryUpdateBaseSchema,
  listGroceriesByUsers,
  updateGroceries,
} from "@norish/db";
import { listRecurringGroceriesByUsers } from "@norish/db/repositories/recurring-groceries";
import {
  findBestIngredientStorePreference,
  getStoreOwnerId,
  normalizeIngredientName,
  upsertIngredientStorePreference,
} from "@norish/db/repositories/stores";
import type { IdSubstitution } from "@norish/shared/contracts";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { AssignGroceryToStoreInputSchema } from "@norish/shared/contracts/zod";
import {
  accumulateGroceryAmounts,
  buildGroceryMergeIndex,
  findGroceryMergeTarget,
  groceryMergeKey,
  type GroceryMergeCandidate,
} from "@norish/shared/lib/grocery-merge";

import { groceryEmitter } from "./emitter";

export type GroceryProcedureContext = {
  user: { id: string };
  userIds: string[];
  householdKey: string;
};

export async function listGroceriesData(ctx: GroceryProcedureContext) {
  log.debug({ userId: ctx.user.id }, "Listing groceries");

  const [groceries, recurringGroceries] = await Promise.all([
    listGroceriesByUsers(ctx.userIds),
    listRecurringGroceriesByUsers(ctx.userIds),
  ]);

  const recipeIngredientIds = groceries
    .map((grocery) => grocery.recipeIngredientId)
    .filter((id): id is string => id !== null);

  const recipeInfoMap = await getRecipeInfoForGroceries(recipeIngredientIds);
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
  input: Array<z.infer<typeof GroceryCreateSchema>>
) {
  const existingGroceries = await listGroceriesByUsers(ctx.userIds, { includeDone: false });
  // The shared merge rule runs here against authoritative state and inside the
  // clients' optimistic path against their cached groceries (ADR-0009).
  const mergeIndex: Map<string, GroceryMergeCandidate> =
    buildGroceryMergeIndex<GroceryMergeCandidate>(existingGroceries);

  const groceriesToCreate: Array<{
    id: string;
    groceries: {
      userId: string;
      name: string | null;
      unit: string | null;
      amount: number | null;
      isDone: boolean;
      recipeIngredientId: string | null;
      recurringGroceryId: string | null;
      storeId: string | null;
    };
  }> = [];
  const pendingCreateById = new Map<string, (typeof groceriesToCreate)[number]>();
  const updateAmountById = new Map<string, number>();
  const returnIds: string[] = [];

  for (const grocery of input) {
    const lookupKey = groceryMergeKey(grocery);
    const existing = findGroceryMergeTarget(mergeIndex, grocery);

    if (existing) {
      const mergedAmount = accumulateGroceryAmounts(existing.amount, grocery.amount);
      const pendingCreate = pendingCreateById.get(existing.id);

      if (pendingCreate) {
        // The target is an earlier item of this batch: accumulate onto the
        // pending insert instead of updating a row that does not exist yet.
        pendingCreate.groceries.amount = mergedAmount;
      } else {
        updateAmountById.set(existing.id, mergedAmount);
      }

      returnIds.push(existing.id);
      mergeIndex.set(lookupKey!, { ...existing, amount: mergedAmount });
      continue;
    }

    const id = grocery.id;
    let storeId: string | null = grocery.storeId ?? null;

    if (!storeId && grocery.name) {
      const match = await findBestIngredientStorePreference(ctx.user.id, ctx.userIds, grocery.name);

      storeId = match?.preference.storeId ?? null;
    }

    const createEntry = {
      id,
      groceries: {
        userId: ctx.user.id,
        name: grocery.name,
        unit: grocery.unit,
        amount: grocery.amount,
        isDone: grocery.isDone ?? false,
        recipeIngredientId: grocery.recipeIngredientId ?? null,
        recurringGroceryId: grocery.recurringGroceryId ?? null,
        storeId,
      },
    };

    groceriesToCreate.push(createEntry);
    pendingCreateById.set(id, createEntry);
    returnIds.push(id);

    if (lookupKey) {
      mergeIndex.set(lookupKey, {
        id,
        name: grocery.name,
        unit: grocery.unit,
        amount: grocery.amount,
        isDone: false,
        recipeIngredientId: grocery.recipeIngredientId ?? null,
        recurringGroceryId: grocery.recurringGroceryId ?? null,
      });
    }
  }

  const groceriesToUpdate = Array.from(updateAmountById, ([id, amount]) => ({ id, amount }));

  let updatedGroceries: GroceryDto[] = [];

  if (groceriesToUpdate.length > 0) {
    updatedGroceries = await updateGroceries(groceriesToUpdate);
    log.info({ userId: ctx.user.id, count: updatedGroceries.length }, "Groceries merged");

    if (updatedGroceries.length > 0) {
      groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
        changedGroceries: updatedGroceries,
      });
    }
  }

  let createdGroceries: GroceryDto[] = [];

  if (groceriesToCreate.length > 0) {
    createdGroceries = await createGroceries(groceriesToCreate, ctx.userIds);
    log.info({ userId: ctx.user.id, count: createdGroceries.length }, "Groceries created");

    if (createdGroceries.length > 0) {
      groceryEmitter.emitToHousehold(ctx.householdKey, "created", {
        groceries: createdGroceries,
      });
    }
  }

  const groceriesById = new Map<string, GroceryDto>();

  for (const grocery of [...updatedGroceries, ...createdGroceries]) {
    groceriesById.set(grocery.id, grocery);
  }

  const returnedGroceries = returnIds
    .map((id) => groceriesById.get(id))
    .filter((grocery): grocery is GroceryDto => grocery !== undefined);

  // One client-to-canonical mapping per submitted item, in input order, so
  // Outbox Replay can rewrite queued dependents generically (ADR-0009).
  const idSubstitutions: IdSubstitution[] = input.map((grocery, index) => ({
    clientId: grocery.id,
    canonicalId: returnIds[index] ?? grocery.id,
  }));

  return {
    ids: returnIds,
    idSubstitutions,
    createdGroceries,
    updatedGroceries,
    returnedGroceries,
  };
}

export async function toggleGroceriesData(
  ctx: GroceryProcedureContext,
  input: z.infer<typeof GroceryToggleSchema>
) {
  const { groceries, isDone } = input;
  const groceryIds = groceries.map((grocery) => grocery.id);
  const versionById = new Map(groceries.map((grocery) => [grocery.id, grocery.version]));

  log.debug({ userId: ctx.user.id, count: groceryIds.length, isDone }, "Toggling groceries");

  const ownerIds = await getGroceryOwnerIds(groceryIds);

  if (ownerIds.size !== groceryIds.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Some groceries not found" });
  }

  for (const ownerId of ownerIds.values()) {
    await assertHouseholdAccess(ctx.user.id, ownerId);
  }

  const existingGroceries = await getGroceriesByIds(groceryIds);

  if (existingGroceries.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Groceries not found" });
  }

  const updatedGroceries = existingGroceries.map((grocery) => ({
    ...grocery,
    version: versionById.get(grocery.id) ?? grocery.version,
    isDone,
  }));

  const parsed = z.array(GroceryUpdateBaseSchema).safeParse(updatedGroceries);

  if (!parsed.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid data" });
  }

  const updated = await updateGroceries(parsed.data as GroceryUpdateDto[]);

  if (updated.length !== parsed.data.length) {
    log.info(
      {
        userId: ctx.user.id,
        requestedCount: parsed.data.length,
        updatedCount: updated.length,
      },
      updated.length === 0
        ? "Stale grocery toggle; requesting client refresh"
        : "Grocery toggle partially applied due to stale versions; requesting client refresh"
    );
    groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
      reason: "Groceries were updated elsewhere",
    });
  }

  log.debug({ userId: ctx.user.id, count: updated.length, isDone }, "Groceries toggled");

  if (updated.length > 0) {
    groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
      changedGroceries: updated,
    });
  }

  return updated;
}

export async function deleteGroceriesData(
  ctx: GroceryProcedureContext,
  input: z.infer<typeof GroceryDeleteSchema>
) {
  const groceryIds = input.groceries.map((grocery) => grocery.id);

  log.info({ userId: ctx.user.id, count: groceryIds.length }, "Deleting groceries");

  const ownerIds = await getGroceryOwnerIds(groceryIds);

  if (ownerIds.size !== groceryIds.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Some groceries not found" });
  }

  for (const ownerId of ownerIds.values()) {
    await assertHouseholdAccess(ctx.user.id, ownerId);
  }

  const result = await deleteGroceryByIds(input.groceries);

  if (result.staleIds.length > 0) {
    log.info(
      { userId: ctx.user.id, staleGroceryIds: result.staleIds },
      "Stale grocery delete mutations; requesting client refresh"
    );
    groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
      reason: "Groceries were updated elsewhere",
    });
  }

  if (result.deletedIds.length > 0) {
    log.info({ userId: ctx.user.id, count: result.deletedIds.length }, "Groceries deleted");
    groceryEmitter.emitToHousehold(ctx.householdKey, "deleted", { groceryIds: result.deletedIds });
  }

  return result;
}

export async function assignGroceryToStoreData(
  ctx: GroceryProcedureContext,
  input: z.infer<typeof AssignGroceryToStoreInputSchema>
) {
  const { groceryId, storeId, savePreference, version } = input;

  log.debug({ userId: ctx.user.id, groceryId, storeId }, "Assigning grocery to store");

  const [ownerIds, storeOwnerId] = await Promise.all([
    getGroceryOwnerIds([groceryId]),
    storeId ? getStoreOwnerId(storeId) : Promise.resolve(null),
  ]);
  const ownerId = ownerIds.get(groceryId);

  if (!ownerId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Grocery not found" });
  }

  await assertHouseholdAccess(ctx.user.id, ownerId);

  if (storeId) {
    if (!storeOwnerId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
    }
    await assertHouseholdAccess(ctx.user.id, storeOwnerId);
  }

  const [grocery] = await getGroceriesByIds([groceryId]);

  if (!grocery) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Grocery not found" });
  }

  const updated = await assignGroceryToStore(groceryId, storeId, ctx.userIds, version);

  if (!updated) {
    log.info(
      { userId: ctx.user.id, groceryId, storeId, version },
      "Stale grocery assign-to-store; requesting client refresh"
    );
    groceryEmitter.emitToHousehold(ctx.householdKey, "stale", {
      reason: "Grocery was updated elsewhere",
    });

    return null;
  }

  log.info({ userId: ctx.user.id, groceryId, storeId }, "Grocery assigned to store");

  if (savePreference && storeId && grocery.name) {
    const normalized = normalizeIngredientName(grocery.name);

    await upsertIngredientStorePreference(ctx.user.id, normalized, storeId);
    log.debug({ userId: ctx.user.id, normalized, storeId }, "Saved ingredient store preference");
  }

  groceryEmitter.emitToHousehold(ctx.householdKey, "updated", {
    changedGroceries: [updated],
  });

  return updated;
}
