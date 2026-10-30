import type { Locator, Page } from "@playwright/test";

import {
  findIngredientAliasesByFolds,
  findIngredientNamesByIds,
} from "@norish/db/repositories/ingredient-aliases";
import { insertSeededIngredient } from "@norish/db/repositories/ingredient-seed";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import type { AIE2EStack } from "./fixture";
import { userIdOf } from "../harness/accounts";
import { deleteEveryGrocery, deleteEveryIngredient, deleteEveryRecipe } from "../harness/reset";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { expect, OWNER } from "./fixture";
import { createPlainStore } from "./grocery-aisles-support";

/** One food the scenario's catalogue knows, with its spellings and their languages. */
export interface SeededFood {
  name: string;
  aliases: Array<{ text: string; locale: string | null }>;
  flagged?: boolean;
}

/**
 * The state the catalogue and Pantry scenarios read: recipes, groceries and Ingredients (a
 * Pantry Ingredient, an Aisle Link and an alias go with their Ingredient). Run before seeding.
 */
export async function resetCatalogueScenario(): Promise<void> {
  await deleteEveryRecipe();
  await deleteEveryGrocery();
  await deleteEveryIngredient();
}

/**
 * The scenario's own small catalogue, with entry ids as the seed writes them so the page lists it,
 * instead of Open Food Facts; the first account owns the foods, so it may edit them.
 */
export async function seedCatalogue(foods: readonly SeededFood[]): Promise<Record<string, string>> {
  const ownerId = await userIdOf(OWNER);
  const ids: Record<string, string> = {};

  for (const food of foods) {
    ids[food.name] = await insertSeededIngredient(
      { name: food.name, offId: `e2e:${food.name}`, ownerId, flagged: food.flagged ?? false },
      food.aliases.map((alias) => ({ ...alias, fold: ingredientAliasFold(alias.text) }))
    );
  }

  return ids;
}

/** A plain Store with one aisle, and the food a name reads as filed in it, as the list files one. */
export async function seedStoreFiling(
  stack: AIE2EStack,
  storeName: string,
  aisleName: string,
  name: string
): Promise<void> {
  const store = await createPlainStore(stack, storeName, { aisles: [aisleName] });

  await callTrpc(stack.baseURL, stack.ownerCookies, "stores.fileGroceryName", {
    storeId: store.id,
    name,
    aisleId: store.aisles[0]!.id,
  });
}

/**
 * The Ingredient this exact spelling points at now. A repository read: `ingredients.find`
 * reads a name as the resolver would, so a deleted "red onion" would still find onion.
 */
export async function readIngredientOf(spelling: string): Promise<string | null> {
  const [alias] = await findIngredientAliasesByFolds([ingredientAliasFold(spelling)]);

  return alias
    ? ((await findIngredientNamesByIds([alias.ingredientId])).get(alias.ingredientId) ?? null)
    : null;
}

/** Place one Ingredient under another, as a person does on the Ingredients page. */
export async function setParent(
  stack: Pick<AIE2EStack, "baseURL" | "ownerCookies">,
  childId: string,
  parentId: string
): Promise<void> {
  await callTrpc(stack.baseURL, stack.ownerCookies, "ingredients.setParent", {
    ingredientId: childId,
    parentId,
  });
}

/** Wait until no AI pass is queued or running, so none takes the ingredient answers queued next. */
export async function waitForAIPasses(stack: Pick<AIE2EStack, "baseURL" | "ownerCookies">) {
  await expect
    .poll(
      () =>
        queryTrpc<unknown[]>(stack.baseURL, stack.ownerCookies, "admin.jobs.list", {
          queue: "ingredient-review",
          states: ["waiting", "active", "delayed"],
          limit: 1,
        }),
      { timeout: 60_000 }
    )
    .toEqual([]);
}

/** The Ingredient catalogue panel of the admin AI & Processing card, opened. */
export async function openCataloguePanel(page: Page): Promise<Locator> {
  await page.goto("/settings?tab=admin");
  const trigger = page.getByRole("button", { name: /^Ingredient catalogue/ }).first();

  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  return page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`);
}
