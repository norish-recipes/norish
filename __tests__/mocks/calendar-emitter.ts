/**
 * Mock for @/server/trpc/routers/calendar/emitter
 */
import { vi } from "vitest";

export const calendarEmitter = {
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

export function resetCalendarEmitterMocks() {
  Object.values(calendarEmitter).forEach((fn) => {
    if (typeof fn === "function" && "mockReset" in fn) {
      fn.mockReset();
    }
  });
}



