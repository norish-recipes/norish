import type z from "zod";
import { TRPCError } from "@trpc/server";

import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  checkStoreNameExistsInHousehold,
  createStore,
  getStoreHouseholdId,
  listStoresByHousehold,
} from "@norish/db/repositories/stores";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { stores } from "@norish/shared-server/realtime/stores";
import { StoreCreateInputSchema } from "@norish/shared/contracts/zod";
import { duplicateAisleName } from "@norish/shared/lib/aisles";

export type StoreProcedureContext = {
  user: { id: string };
  householdId: string;
};

/**
 * A Store belongs to one household; its products, links and the groceries filed under it follow it
 * exactly. Whether the Store exists, refusing one of another household.
 */
export async function storeExistsForHousehold(
  ctx: Pick<StoreProcedureContext, "householdId">,
  storeId: string
): Promise<boolean> {
  const householdId = await getStoreHouseholdId(storeId);

  if (!householdId) return false;
  assertHouseholdAccess(ctx.householdId, householdId);

  return true;
}

/** Every procedure handed a store id (to price under, link to, or file a grocery in) holds it to this. */
export async function assertStoreAccess(
  ctx: Pick<StoreProcedureContext, "householdId">,
  storeId: string
): Promise<void> {
  if (!(await storeExistsForHousehold(ctx, storeId))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
  }
}

export async function listStoresData(ctx: StoreProcedureContext) {
  log.debug({ userId: ctx.user.id }, "Listing stores");

  const stores = await listStoresByHousehold(ctx.householdId);

  log.debug({ userId: ctx.user.id, storeCount: stores.length }, "Stores listed");

  return stores;
}

/**
 * A Store's aisle names are unique regardless of case, checked here the way a
 * duplicate Store name is, so the editor's refusal and the server's agree.
 */
export function assertAisleNamesUnique(aisles: { name: string }[] | undefined): void {
  const duplicate = duplicateAisleName((aisles ?? []).map((aisle) => aisle.name));

  if (duplicate !== null) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `This store already has an aisle named ${duplicate}`,
    });
  }
}

export async function createStoreData(
  ctx: StoreProcedureContext,
  input: z.infer<typeof StoreCreateInputSchema>
) {
  const storeId = input.id ?? crypto.randomUUID();

  log.info({ userId: ctx.user.id, storeName: input.name }, "Creating store");

  const exists = await checkStoreNameExistsInHousehold(input.name, ctx.householdId);

  if (exists) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "A store with this name already exists",
    });
  }
  assertAisleNamesUnique(input.aisles);

  const storeData = {
    householdId: ctx.householdId,
    userId: ctx.user.id,
    name: input.name,
    color: input.color ?? "primary",
    sortOrder: 0,
    website: input.website ?? null,
    searchAddress: input.searchAddress ?? null,
    // A new Store can be made with its aisles in one go; the REST create,
    // which knows nothing of aisles, makes one with none.
    ...(input.aisles === undefined ? {} : { aisles: input.aisles }),
  };

  const createdStore = await createStore(storeId, storeData);

  log.info({ userId: ctx.user.id, storeId: createdStore.id }, "Store created");
  void stores.publish(
    "created",
    {
      store: createdStore,
    },
    { householdId: ctx.householdId }
  );

  return createdStore;
}
