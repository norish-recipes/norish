import { TRPCError } from "@trpc/server";

import { getConfig } from "@/server/db/repositories/server-config";
import { getHouseholdForUser } from "@/server/db/repositories/households";
import {
  ServerConfigKeys,
  type RecipePermissionPolicy,
  DEFAULT_RECIPE_PERMISSION_POLICY,
  type AIConfig,
} from "@/server/db/zodSchemas/server-config";

export async function getRecipePermissionPolicy(): Promise<RecipePermissionPolicy> {
  const value = await getConfig<RecipePermissionPolicy>(ServerConfigKeys.RECIPE_PERMISSION_POLICY);

  return value ?? DEFAULT_RECIPE_PERMISSION_POLICY;
}

export async function isAIEnabled(): Promise<boolean> {
  const aiConfig = await getConfig<AIConfig>(ServerConfigKeys.AI_CONFIG);

  return aiConfig?.enabled ?? false;
}

export type PermissionAction = "view" | "edit" | "delete";

export async function canAccessResource(
  action: PermissionAction,
  userId: string,
  ownerId: string,
  userHouseholdUserIds: string[] | null,
  isServerAdmin: boolean
): Promise<boolean> {
  if (userId === ownerId || isServerAdmin) return true;

  const policy = await getRecipePermissionPolicy();
  const policyLevel = policy[action];

  switch (policyLevel) {
    case "everyone":
      return true;

    case "household": {
      if (!userHouseholdUserIds) return false;

      // Check if owner is in user's household (households are symmetric)
      return userHouseholdUserIds.includes(ownerId);
    }
    default:
      return false;
  }
}

export async function canAccessHouseholdResource(
  userId: string,
  resourceOwnerId: string
): Promise<boolean> {
  // Owner always has access
  if (userId === resourceOwnerId) return true;

  // Check if user shares a household with the owner
  const userHousehold = await getHouseholdForUser(userId);

  if (!userHousehold) return false;

  // Check if owner is in the user's household
  const householdUserIds = userHousehold.users.map((u) => u.id);

  return householdUserIds.includes(resourceOwnerId);
}

export async function assertHouseholdAccess(
  userId: string,
  resourceOwnerId: string
): Promise<void> {
  const hasAccess = await canAccessHouseholdResource(userId, resourceOwnerId);

  if (!hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this resource",
    });
  }
}

export async function assertAIEnabled(): Promise<void> {
  const enabled = await isAIEnabled();

  if (!enabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "AI features are disabled",
    });
  }
}
