/**
 * Mock for @norish/shared/lib/helpers
 */
import { vi } from "vitest";

export const parseIngredientWithDefaults = vi
  .fn()
  .mockReturnValue([{ description: "Test", quantity: 1, unitOfMeasure: "piece" }]);

export const parseJsonWithRepair = vi.fn();
export const parseIsoDuration = vi.fn();
export const formatMinutesHM = vi.fn();
export const debounce = vi.fn((fn) => fn);

export function resetHelpersMocks() {
  parseIngredientWithDefaults
    .mockReset()
    .mockReturnValue([{ description: "Test", quantity: 1, unitOfMeasure: "piece" }]);
  parseJsonWithRepair.mockReset();
  parseIsoDuration.mockReset();
  formatMinutesHM.mockReset();
  debounce.mockReset().mockImplementation((fn) => fn);
}
