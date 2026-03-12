/**
 * Mock for @norish/auth/permissions
 */
import { vi } from "vitest";

export const assertHouseholdAccess = vi.fn();
export const canAccessResource = vi.fn();
export const canAccessHouseholdResource = vi.fn();

export function resetPermissionsMocks() {
  assertHouseholdAccess.mockReset();
  canAccessResource.mockReset();
  canAccessHouseholdResource.mockReset();
}
