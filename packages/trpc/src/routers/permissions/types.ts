import type { RecipePermissionPolicy } from "@norish/config/zod/server-config";

/**
 * Permissions subscription event payloads.
 */
export type PermissionsSubscriptionEvents = {
  /** Permission policy updated */
  policyUpdated: { recipePolicy: RecipePermissionPolicy };
};
