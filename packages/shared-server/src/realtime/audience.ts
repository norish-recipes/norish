import { getCookbookRow } from "@norish/db/repositories/cookbooks";
import { getHouseholdIdForUser } from "@norish/db/repositories/households";
import { getRecipeHouseholdIds } from "@norish/db/repositories/recipes";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";

import type { PolicyTarget } from "./domain";

/** Who hears of an event about a household's recipes or cookbooks, under the policy at publish. */
export async function policyAudience(householdId: string): Promise<PolicyTarget> {
  return { viewPolicy: (await getRecipePermissionPolicy()).view, householdId };
}

/** A recipe's audience from the household its row is in now; null once it is gone. */
export async function recipeAudience(recipeId: string): Promise<PolicyTarget | null> {
  const householdId = (await getRecipeHouseholdIds([recipeId])).get(recipeId);

  return householdId ? policyAudience(householdId) : null;
}

/** A cookbook's audience from the household its row is in now; null once it is gone. */
export async function cookbookAudience(cookbookId: string): Promise<PolicyTarget | null> {
  const householdId = (await getCookbookRow(cookbookId))?.householdId;

  return householdId ? policyAudience(householdId) : null;
}

/** For an account's event about nothing stored yet (an import pending or failed): its household now. */
export async function accountAudience(userId: string): Promise<PolicyTarget | null> {
  const householdId = await getHouseholdIdForUser(userId);

  return householdId ? policyAudience(householdId) : null;
}
