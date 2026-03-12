/**
 * Mock for user and api-keys repositories
 */
import { vi } from "vitest";

// User repository mocks
export const getUserById = vi.fn();
export const updateUserName = vi.fn();
export const updateUserAvatar = vi.fn();
export const clearUserAvatar = vi.fn();
export const deleteUser = vi.fn();
export const getHouseholdForUser = vi.fn();
export const getUserPreferences = vi.fn();
export const updateUserPreferences = vi.fn();

// API keys repository mocks
export const getApiKeysForUser = vi.fn();
export const createApiKey = vi.fn();
export const deleteApiKey = vi.fn();
export const enableApiKey = vi.fn();
export const disableApiKey = vi.fn();

export function resetUserMocks() {
  getUserById.mockReset();
  updateUserName.mockReset();
  updateUserAvatar.mockReset();
  clearUserAvatar.mockReset();
  deleteUser.mockReset();
  getHouseholdForUser.mockReset();
  getUserPreferences.mockReset();
  updateUserPreferences.mockReset();
  getApiKeysForUser.mockReset();
  createApiKey.mockReset();
  deleteApiKey.mockReset();
  enableApiKey.mockReset();
  disableApiKey.mockReset();
}
