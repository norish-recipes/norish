/**
 * Mock for @norish/shared/lib/recurrence/calculator
 */
import { vi } from "vitest";

export const calculateNextOccurrence = vi.fn();
export const getTodayString = vi.fn().mockReturnValue("2025-11-29");

export function resetRecurrenceMocks() {
  calculateNextOccurrence.mockReset();
  getTodayString.mockReset().mockReturnValue("2025-11-29");
}
