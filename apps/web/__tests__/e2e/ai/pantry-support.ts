import type { GroceryDto } from "@norish/shared/contracts/dto/groceries";
import type { PantryIngredientDto } from "@norish/shared/contracts/dto/pantry";
import { upsertIngredientStorePreference } from "@norish/db/repositories/stores";

import type { AIE2EStack } from "./fixture";
import { callTrpc } from "../harness/trpc";
import { createPlainStore, ingredientIdOf } from "./grocery-aisles-support";

/**
 * A Store the household sends a food to: the store preference a grocery added without a Store
 * is filed by. A repository write: the app only learns one from a grocery moved there. Its id.
 */
export async function seedStorePreference(
  stack: AIE2EStack,
  storeName: string,
  ingredientName: string
): Promise<string> {
  const ingredientId = await ingredientIdOf(stack, ingredientName);

  if (!ingredientId) throw new Error(`No food is called ${ingredientName}`);
  const store = await createPlainStore(stack, storeName);

  await upsertIngredientStorePreference(store.userId, ingredientId, store.id);

  return store.id;
}

/** The household's groceries, ticked or not: each one's name, Store and tick, by name. */
export async function readGroceries(
  stack: AIE2EStack
): Promise<Array<{ name: string; storeId: string | null; isDone: boolean }>> {
  const { groceries } = await callTrpc<{ groceries: GroceryDto[] }>(
    stack.baseURL,
    stack.ownerCookies,
    "groceries.list"
  );

  return groceries
    .map((grocery) => ({
      name: grocery.name ?? "",
      storeId: grocery.storeId,
      isDone: grocery.isDone,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The household's Pantry: every name, lowercase, in order. */
export async function readPantryNames(stack: AIE2EStack): Promise<string[]> {
  const pantry = await callTrpc<PantryIngredientDto[]>(
    stack.baseURL,
    stack.ownerCookies,
    "pantry.list"
  );

  return pantry.map((item) => item.name.toLowerCase()).sort((a, b) => a.localeCompare(b));
}

/** The grocery names on the household's list. */
export async function readGroceryNames(stack: AIE2EStack): Promise<string[]> {
  return (await readGroceries(stack)).map((grocery) => grocery.name);
}
