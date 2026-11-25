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
  /** The household's members, the Reader included. */
  householdMemberIds: string[];
  isServerAdmin: boolean;
};

/** What a recipe permission is decided by. */
type RecipeAccess = Pick<
  ReaderPermissions,
  "recipePolicy" | "householdMemberIds" | "isServerAdmin"
>;

type PermissionAccessInput = {
  policyLevel: PermissionLevel;
  userId: string;
  ownerId: string;
  householdMemberIds: string[];
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
    householdMemberIds: input?.householdMemberIds ?? [],
    isServerAdmin: input?.isServerAdmin ?? false,
  };
}

function checkPermissionAccess({
  policyLevel,
  userId,
  ownerId,
  householdMemberIds,
  isServerAdmin,
}: PermissionAccessInput): boolean {
  if (userId === ownerId) return true;
  if (isServerAdmin) return true;

  switch (policyLevel) {
    case "everyone":
      return true;
    case "household":
      return householdMemberIds.includes(ownerId);
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
    householdMemberIds: permissions.householdMemberIds,
    isServerAdmin: permissions.isServerAdmin,
  });
}

export function selectCanEditRecipe(permissions: RecipeAccess, userId: string, ownerId: string) {
  return checkPermissionAccess({
    policyLevel: permissions.recipePolicy.edit,
    userId,
    ownerId,
    householdMemberIds: permissions.householdMemberIds,
    isServerAdmin: permissions.isServerAdmin,
  });
}

export function selectCanDeleteRecipe(permissions: RecipeAccess, userId: string, ownerId: string) {
  return checkPermissionAccess({
    policyLevel: permissions.recipePolicy.delete,
    userId,
    ownerId,
    householdMemberIds: permissions.householdMemberIds,
    isServerAdmin: permissions.isServerAdmin,
  });
}
