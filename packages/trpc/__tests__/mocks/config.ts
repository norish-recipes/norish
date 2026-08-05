/**
 * Mock for @norish/shared-server/config/server-config-loader
 */
import { vi } from "vitest";

export const getUnits = vi.fn().mockResolvedValue({});
export const getRecurrenceConfig = vi.fn().mockResolvedValue({});
export const getRecipePermissionPolicy = vi
  .fn()
  .mockResolvedValue({ view: "household", edit: "household", delete: "household" });
export const isVideoParsingEnabled = vi.fn().mockResolvedValue(true);

export function resetConfigMocks() {
  getUnits.mockReset().mockResolvedValue({});
  getRecurrenceConfig.mockReset().mockResolvedValue({});
  getRecipePermissionPolicy
    .mockReset()
    .mockResolvedValue({ view: "household", edit: "household", delete: "household" });
  isVideoParsingEnabled.mockReset().mockResolvedValue(true);
}
