import type { inferRouterOutputs } from "@trpc/server";

import type { RecipePermissionPolicy } from "@norish/config/zod/server-config";
import type { AppRouter } from "@norish/trpc/client";
import { policyAllows } from "@norish/config/zod/server-config";

export type PermissionsData = inferRouterOutputs<AppRouter>["permissions"]["get"];

/** What the Reader may do, with conservative defaults where the server hasn't said. */
export type ReaderPermissions = {
  recipePolicy: RecipePermissionPolicy;
  isAIEnabled: boolean;
  /** AI is on and an image provider can draw: Generate shows only then. */
  canDrawImages: boolean;
  /** The Reader's household; null until the server has said. */
  householdId: string | null;
  isServerAdmin: boolean;
};

/** What a recipe or cookbook permission is decided by. */
type RowAccess = Pick<ReaderPermissions, "recipePolicy" | "householdId">;

const DEFAULT_RECIPE_POLICY: RecipePermissionPolicy = {
  view: "household",
  edit: "household",
  delete: "household",
};

export function normalizePermissionsData(
  input: PermissionsData | null | undefined
): ReaderPermissions {
  return {
    recipePolicy: input?.recipePolicy ?? DEFAULT_RECIPE_POLICY,
    isAIEnabled: input?.isAIEnabled ?? false,
    canDrawImages: input?.canDrawImages ?? false,
    householdId: input?.householdId ?? null,
    isServerAdmin: input?.isServerAdmin ?? false,
  };
}

/** The server's rule (`policyAllows`) for a row of `rowHouseholdId`; no answer yet is no. */
export function selectAllows(
  permissions: RowAccess,
  action: keyof RecipePermissionPolicy,
  rowHouseholdId: string
) {
  return (
    permissions.householdId !== null &&
    policyAllows(permissions.recipePolicy, action, permissions.householdId, rowHouseholdId)
  );
}
