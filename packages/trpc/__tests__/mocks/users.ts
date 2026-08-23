/**
 * Mock for users repository
 */
import { vi } from "vitest";

export const isUserServerAdmin = vi.fn();
export const listUsersForAdmin = vi.fn();
export const getUserRoleFlags = vi.fn();
export const setUserAdminStatus = vi.fn();
export const deleteUser = vi.fn();

export function resetUsersMocks() {
  isUserServerAdmin.mockReset();
  listUsersForAdmin.mockReset();
  getUserRoleFlags.mockReset();
  setUserAdminStatus.mockReset();
  deleteUser.mockReset();
}
