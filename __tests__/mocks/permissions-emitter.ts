/**
 * Mock for permissions emitter
 */
import { vi } from "vitest";

export const permissionsEmitter = {
  broadcast: vi.fn(),
  emitToHousehold: vi.fn(),
  emitToUser: vi.fn(),
  emitGlobal: vi.fn(),
  broadcastEvent: vi.fn((event: string) => `norish:broadcast:${event}`),
  householdEvent: vi.fn(
    (householdKey: string, event: string) => `norish:household:${householdKey}:${event}`
  ),
  userEvent: vi.fn((userId: string, event: string) => `norish:user:${userId}:${event}`),
  globalEvent: vi.fn((event: string) => `norish:global:${event}`),
  createSubscription: vi.fn(),
};
