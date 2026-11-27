import { withTransaction } from "@norish/db/drizzle";
import { deleteGroceryByIds, listGroceriesByHousehold } from "@norish/db/repositories/groceries";
import { getHouseholdIdForUser } from "@norish/db/repositories/households";
import { deleteCatalogueIngredient } from "@norish/db/repositories/ingredient-catalogue";
import { listIconCatalogue } from "@norish/db/repositories/ingredient-icons";
import { lockTree } from "@norish/db/repositories/ingredient-relocation";
import { deleteRecipeById, getAllRecipesForEnrichment } from "@norish/db/repositories/recipes";
import {
  deleteRecurringGroceryByIds,
  listRecurringGroceriesByHousehold,
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
  const householdIds = new Set<string>();

  for (const userId of await getAllUserIds()) {
    const householdId = await getHouseholdIdForUser(userId);

    if (householdId) householdIds.add(householdId);
  }
  for (const householdId of householdIds) {
    await deleteGroceryByIds(
      await listGroceriesByHousehold(householdId, { includeDone: true }),
      householdId
    );
    await deleteRecurringGroceryByIds(
      (await listRecurringGroceriesByHousehold(householdId)).map((recurring) => recurring.id),
      householdId
    );
  }
}

/** Delete these Ingredients; their spellings, links and Pantry rows go with them. */
export async function deleteIngredients(ids: readonly string[]): Promise<void> {
  await withTransaction(async (tx) => {
    await lockTree(tx);
    for (const id of ids) await deleteCatalogueIngredient(tx, id);
  });
}

/** Delete every Ingredient on the server, the seed's and every household's. */
export async function deleteEveryIngredient(): Promise<void> {
  await deleteIngredients([...(await listIconCatalogue()).keys()]);
}
