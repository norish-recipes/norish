/**
 * Mock for users repository
 */
import { vi } from "vitest";

export const isUserServerAdmin = vi.fn();

export function resetUsersMocks() {
  isUserServerAdmin.mockReset();
}
