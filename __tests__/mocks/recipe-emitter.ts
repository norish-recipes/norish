/**
 * Mock for @/server/trpc/routers/recipes/emitter
 */
import { vi } from "vitest";

export const recipeEmitter = {
  emitToHousehold: vi.fn(),
  emitToUser: vi.fn(),
  broadcast: vi.fn(),
  emitGlobal: vi.fn(),
  householdEvent: vi.fn(
    (householdKey: string, event: string) => `norish:household:${householdKey}:${event}`
  ),
  userEvent: vi.fn((userId: string, event: string) => `norish:user:${userId}:${event}`),
  broadcastEvent: vi.fn((event: string) => `norish:broadcast:${event}`),
  globalEvent: vi.fn((event: string) => `norish:global:${event}`),
  createSubscription: vi.fn(),
};

export function resetRecipeEmitterMock() {
  Object.values(recipeEmitter).forEach((fn) => {
    if (typeof fn === "function" && "mockReset" in fn) {
      fn.mockReset();
    }
  });
}

