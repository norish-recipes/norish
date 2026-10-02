/**
 * Mock for @norish/auth/permissions
 */
import { vi } from "vitest";

export const assertHouseholdAccess = vi.fn();
export const canAccessResource = vi.fn();
export const canAccessHouseholdResource = vi.fn();
export const isAIEnabled = vi.fn().mockResolvedValue(true);
/** Refuses as the real one does, by what `isAIEnabled` is set to answer. */
export const assertAIEnabled = vi.fn(async () => {
  if (!(await isAIEnabled())) throw new Error("AI features are disabled");
});

export function resetPermissionsMocks() {
  assertHouseholdAccess.mockReset();
  canAccessResource.mockReset();
  canAccessHouseholdResource.mockReset();
  isAIEnabled.mockReset().mockResolvedValue(true);
}
