import type { AutoTaggingMode, RecipePermissionPolicy } from "@norish/config/zod/server-config";

import type { NormalizedPermissionsData, PermissionAccessInput, PermissionsData } from "./types";

const DEFAULT_RECIPE_POLICY: RecipePermissionPolicy = {
  view: "owner",
  edit: "owner",
  delete: "owner",
};

const DEFAULT_AUTO_TAGGING_MODE: AutoTaggingMode = "disabled";

export function normalizePermissionsData(
  input: PermissionsData | null | undefined
): NormalizedPermissionsData {
  return {
    recipePolicy: input?.recipePolicy ?? DEFAULT_RECIPE_POLICY,
    isAIEnabled: input?.isAIEnabled ?? false,
    householdUserIds: input?.householdUserIds ?? null,
    isServerAdmin: input?.isServerAdmin ?? false,
    autoTaggingMode: input?.autoTaggingMode ?? DEFAULT_AUTO_TAGGING_MODE,
  };
}

export function checkPermissionAccess({
  policyLevel,
  userId,
  ownerId,
  householdUserIds,
  isServerAdmin,
}: PermissionAccessInput): boolean {
  if (userId === ownerId) return true;
  if (isServerAdmin) return true;

  switch (policyLevel) {
    case "everyone":
      return true;
    case "household":
      return householdUserIds?.includes(ownerId) ?? false;
    case "owner":
    default:
      return false;
  }
}

export function selectCanViewRecipe(
  permissions: NormalizedPermissionsData,
  userId: string,
  ownerId: string
) {
  return checkPermissionAccess({
    policyLevel: permissions.recipePolicy.view,
    userId,
    ownerId,
    householdUserIds: permissions.householdUserIds,
    isServerAdmin: permissions.isServerAdmin,
  });
}

export function selectCanEditRecipe(
  permissions: NormalizedPermissionsData,
  userId: string,
  ownerId: string
) {
  return checkPermissionAccess({
    policyLevel: permissions.recipePolicy.edit,
    userId,
    ownerId,
    householdUserIds: permissions.householdUserIds,
    isServerAdmin: permissions.isServerAdmin,
  });
}

export function selectCanDeleteRecipe(
  permissions: NormalizedPermissionsData,
  userId: string,
  ownerId: string
) {
  return checkPermissionAccess({
    policyLevel: permissions.recipePolicy.delete,
    userId,
    ownerId,
    householdUserIds: permissions.householdUserIds,
    isServerAdmin: permissions.isServerAdmin,
  });
}

export function selectIsAutoTaggingEnabled(permissions: NormalizedPermissionsData): boolean {
  return permissions.autoTaggingMode !== "disabled";
}
