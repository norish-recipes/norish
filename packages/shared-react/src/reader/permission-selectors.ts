import type { inferRouterOutputs } from "@trpc/server";

import type { PermissionLevel, RecipePermissionPolicy } from "@norish/config/zod/server-config";
import type { AppRouter } from "@norish/trpc/client";

export type PermissionsData = inferRouterOutputs<AppRouter>["permissions"]["get"];

/** What the Reader may do, with conservative defaults where the server hasn't said. */
export type ReaderPermissions = {
  recipePolicy: RecipePermissionPolicy;
  isAIEnabled: boolean;
  /** AI is on and an image provider can draw: Generate shows only then. */
  canDrawImages: boolean;
  /** The household's members, or null outside one. */
  householdUserIds: string[] | null;
  isServerAdmin: boolean;
};

/** What a recipe permission is decided by. */
type RecipeAccess = Pick<ReaderPermissions, "recipePolicy" | "householdUserIds" | "isServerAdmin">;

type PermissionAccessInput = {
  policyLevel: PermissionLevel;
  userId: string;
  ownerId: string;
  householdUserIds: string[] | null;
  isServerAdmin: boolean;
};

const DEFAULT_RECIPE_POLICY: RecipePermissionPolicy = {
  view: "owner",
  edit: "owner",
  delete: "owner",
};

export function normalizePermissionsData(
  input: PermissionsData | null | undefined
): ReaderPermissions {
  return {
    recipePolicy: input?.recipePolicy ?? DEFAULT_RECIPE_POLICY,
    isAIEnabled: input?.isAIEnabled ?? false,
    canDrawImages: input?.canDrawImages ?? false,
    householdUserIds: input?.householdUserIds ?? null,
    isServerAdmin: input?.isServerAdmin ?? false,
  };
}

function checkPermissionAccess({
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

export function selectCanViewRecipe(permissions: RecipeAccess, userId: string, ownerId: string) {
  return checkPermissionAccess({
    policyLevel: permissions.recipePolicy.view,
    userId,
    ownerId,
    householdUserIds: permissions.householdUserIds,
    isServerAdmin: permissions.isServerAdmin,
  });
}

export function selectCanEditRecipe(permissions: RecipeAccess, userId: string, ownerId: string) {
  return checkPermissionAccess({
    policyLevel: permissions.recipePolicy.edit,
    userId,
    ownerId,
    householdUserIds: permissions.householdUserIds,
    isServerAdmin: permissions.isServerAdmin,
  });
}

export function selectCanDeleteRecipe(permissions: RecipeAccess, userId: string, ownerId: string) {
  return checkPermissionAccess({
    policyLevel: permissions.recipePolicy.delete,
    userId,
    ownerId,
    householdUserIds: permissions.householdUserIds,
    isServerAdmin: permissions.isServerAdmin,
  });
}
