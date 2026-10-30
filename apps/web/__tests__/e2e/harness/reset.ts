import { withTransaction } from "@norish/db/drizzle";
import { deleteGroceryByIds, listGroceriesByUsers } from "@norish/db/repositories/groceries";
import { deleteCatalogueIngredient } from "@norish/db/repositories/ingredient-catalogue";
import { lockTree } from "@norish/db/repositories/ingredient-relocation";
import { listCatalogueForExport } from "@norish/db/repositories/ingredient-seed";
import { deleteRecipeById, getAllRecipesForEnrichment } from "@norish/db/repositories/recipes";
import {
  deleteRecurringGroceryByIds,
  listRecurringGroceriesByUsers,
} from "@norish/db/repositories/recurring-groceries";
import { getAllUserIds } from "@norish/db/repositories/users";

/** Delete every recipe on the server, whoever owns it. */
export async function deleteEveryRecipe(): Promise<void> {
  for (const { recipeId } of await getAllRecipesForEnrichment()) {
    await deleteRecipeById(recipeId);
  }
}

/** Delete every grocery and recurring grocery on the server, ticked or not. */
export async function deleteEveryGrocery(): Promise<void> {
  const userIds = await getAllUserIds();
  const groceries = await listGroceriesByUsers(userIds, { includeDone: true });

  await deleteGroceryByIds(groceries, userIds);
  await deleteRecurringGroceryByIds(
    (await listRecurringGroceriesByUsers(userIds)).map((recurring) => recurring.id)
  );
}

/** Delete these Ingredients; their spellings, links and Pantry rows go with them. */
export async function deleteIngredients(ids: readonly string[]): Promise<void> {
  await withTransaction(async (tx) => {
    await lockTree(tx);
    for (const id of ids) await deleteCatalogueIngredient(tx, id);
  });
}

/** Delete every Ingredient on the server. */
export async function deleteEveryIngredient(): Promise<void> {
  await deleteIngredients((await listCatalogueForExport()).ingredients.map(({ id }) => id));
}
