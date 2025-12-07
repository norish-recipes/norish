/**
 * Mock for @/server/trpc/routers/caldav/emitter
 */
import { vi } from "vitest";

export const caldavEmitter = {
  emitToUser: vi.fn(),
  emitToHousehold: vi.fn(),
  broadcast: vi.fn(),
  emitGlobal: vi.fn(),
  userEvent: vi.fn((userId: string, event: string) => `norish:user:${userId}:${event}`),
  householdEvent: vi.fn((householdKey: string, event: string) => `norish:household:${householdKey}:${event}`),
  broadcastEvent: vi.fn((event: string) => `norish:broadcast:${event}`),
  globalEvent: vi.fn((event: string) => `norish:global:${event}`),
  createSubscription: vi.fn(),
};

export function resetCaldavEmitterMock() {
  Object.values(caldavEmitter).forEach((fn) => {
    if (typeof fn === "function" && "mockReset" in fn) {
      fn.mockReset();
    }
  });
}

export default { caldavEmitter };
