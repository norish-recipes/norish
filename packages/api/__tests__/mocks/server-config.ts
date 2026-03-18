/**
 * Mock for server-config repository
 */
import { vi } from "vitest";

export const getAllConfigs = vi.fn();
export const getConfig = vi.fn();
export const setConfig = vi.fn();
export const deleteConfig = vi.fn();
export const configExists = vi.fn();
export const getConfigSecret = vi.fn();
export const getAllConfigKeys = vi.fn();

export function resetServerConfigMocks() {
  getAllConfigs.mockReset();
  getConfig.mockReset();
  setConfig.mockReset();
  deleteConfig.mockReset();
  configExists.mockReset();
  getConfigSecret.mockReset();
  getAllConfigKeys.mockReset();
}
