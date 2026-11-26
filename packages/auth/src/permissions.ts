import type { AIConfig, RecipePermissionPolicy } from "@norish/config/zod/server-config";
import {
  DEFAULT_RECIPE_PERMISSION_POLICY,
  policyAllows,
  ServerConfigKeys,
} from "@norish/config/zod/server-config";
import { getConfig } from "@norish/db/repositories/server-config";

export async function getRecipePermissionPolicy(): Promise<RecipePermissionPolicy> {
  const value = await getConfig<RecipePermissionPolicy>(ServerConfigKeys.RECIPE_PERMISSION_POLICY);

  return value ?? DEFAULT_RECIPE_PERMISSION_POLICY;
}

export async function isAIEnabled(): Promise<boolean> {
  const aiConfig = await getConfig<AIConfig>(ServerConfigKeys.AI_CONFIG);

  return aiConfig?.enabled ?? false;
}

export type PermissionAction = "view" | "edit" | "delete";

/** Whether a reader in `readerHouseholdId` may act on a recipe or cookbook of `rowHouseholdId`. */
export async function canAccessResource(
  action: PermissionAction,
  readerHouseholdId: string,
  rowHouseholdId: string
): Promise<boolean> {
  return policyAllows(await getRecipePermissionPolicy(), action, readerHouseholdId, rowHouseholdId);
}

/** What a reader may do to a recipe or cookbook of `rowHouseholdId`: nothing at all (undefined,
 * it reads as missing) unless they may view it, then whether `action` is allowed. */
export async function resourceAccess(
  action: PermissionAction,
  readerHouseholdId: string,
  rowHouseholdId: string
): Promise<boolean | undefined> {
  if (!(await canAccessResource("view", readerHouseholdId, rowHouseholdId))) return undefined;

  return action === "view" || (await canAccessResource(action, readerHouseholdId, rowHouseholdId));
}

export async function assertAIEnabled(): Promise<void> {
  const enabled = await isAIEnabled();

  if (!enabled) {
    throw new Error("AI features are disabled");
  }
}
