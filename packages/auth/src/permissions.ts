import type { AIConfig, RecipePermissionPolicy } from "@norish/config/zod/server-config";
import {
  DEFAULT_RECIPE_PERMISSION_POLICY,
  ServerConfigKeys,
} from "@norish/config/zod/server-config";
import { isHouseholdMember } from "@norish/db/repositories/households";
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

/** Who is asking: the account, its household, and whether it administers the server. */
export interface PermissionViewer {
  userId: string;
  householdId: string;
  isServerAdmin: boolean;
}

export async function canAccessResource(
  action: PermissionAction,
  viewer: PermissionViewer,
  ownerId: string
): Promise<boolean> {
  if (viewer.userId === ownerId || viewer.isServerAdmin) return true;

  const policy = await getRecipePermissionPolicy();

  switch (policy[action]) {
    case "everyone":
      return true;
    case "household":
      return isHouseholdMember(viewer.householdId, ownerId);
    default:
      return false;
  }
}

/** Refuses a household row whose owner is not in the caller's household. */
export async function assertHouseholdAccess(householdId: string, ownerId: string): Promise<void> {
  if (!(await isHouseholdMember(householdId, ownerId))) {
    throw new Error("FORBIDDEN");
  }
}

export async function assertAIEnabled(): Promise<void> {
  const enabled = await isAIEnabled();

  if (!enabled) {
    throw new Error("AI features are disabled");
  }
}
