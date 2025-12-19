import { vi } from "vitest";

export const ratingsEmitter = {
  emitToHousehold: vi.fn(),
  emitToUser: vi.fn(),
  broadcast: vi.fn(),
};
