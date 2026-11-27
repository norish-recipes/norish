/**
 * Mock for @norish/auth/permissions. `canAccessResource` applies the real rule to `policy`,
 * so a router test sets the policy and the rows' households rather than an answer.
 */
import { vi } from "vitest";

import type { RecipePermissionPolicy } from "@norish/config/zod/server-config";
import { DEFAULT_RECIPE_PERMISSION_POLICY, policyAllows } from "@norish/config/zod/server-config";

export const policy: RecipePermissionPolicy = { ...DEFAULT_RECIPE_PERMISSION_POLICY };

export const canAccessResource = vi.fn(
  async (action: keyof RecipePermissionPolicy, reader: string, row: string) =>
    policyAllows(policy, action, reader, row)
);
export const getRecipePermissionPolicy = vi.fn(async () => ({ ...policy }));
export const resourceAccess = vi.fn(
  async (action: keyof RecipePermissionPolicy, reader: string, row: string) => {
    if (!(await canAccessResource("view", reader, row))) return undefined;

    return action === "view" || (await canAccessResource(action, reader, row));
  }
);
export const isAIEnabled = vi.fn().mockResolvedValue(true);
/** Refuses as the real one does, by what `isAIEnabled` is set to answer. */
export const assertAIEnabled = vi.fn(async () => {
  if (!(await isAIEnabled())) throw new Error("AI features are disabled");
});

export function resetPermissionsMocks() {
  Object.assign(policy, DEFAULT_RECIPE_PERMISSION_POLICY);
  canAccessResource.mockClear();
  isAIEnabled.mockReset().mockResolvedValue(true);
}
