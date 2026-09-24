// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";
import { ENVELOPE_VERSION } from "@norish/shared/contracts/realtime/envelope";

/** A hub that dispatches by exact channel, like the real one. */
const hub = vi.hoisted(() => {
  const handlers = new Map<string, Set<(envelope: unknown) => void>>();

  return {
    handlers,
    on: vi.fn((channel: string, handler: (envelope: unknown) => void) => {
      const set = handlers.get(channel) ?? new Set();

      set.add(handler);
      handlers.set(channel, set);

      return () => {
        set.delete(handler);
      };
    }),
    emit(channel: string, envelope: unknown) {
      for (const handler of handlers.get(channel) ?? []) handler(envelope);
    },
  };
});

vi.mock("@norish/shared-server/realtime/hub", () => ({ getRealtimeHub: () => hub }));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const {
  CONNECTION_INVALIDATION_CHANNEL,
  registerConnection,
  startConnectionInvalidation,
  unregisterConnection,
} = await import("../src/connection-manager");

function envelope(payload: unknown): RealtimeEventEnvelope {
  return {
    meta: {
      version: ENVELOPE_VERSION,
      eventId: "uuid-1",
      eventName: "invalidate",
      namespace: "connection",
      scope: "internal",
      channel: CONNECTION_INVALIDATION_CHANNEL,
      occurredAt: new Date().toISOString(),
    },
    payload,
  };
}

function fakeSocket() {
  return { close: vi.fn() } as unknown as import("ws").WebSocket;
}

describe("connection invalidation on the hub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hub.handlers.clear();
  });

  it("registers on the internal connection channel", () => {
    const stop = startConnectionInvalidation();

    expect(CONNECTION_INVALIDATION_CHANNEL).toBe("norish:connection:internal:invalidate");
    expect(hub.on).toHaveBeenCalledWith(CONNECTION_INVALIDATION_CHANNEL, expect.any(Function));

    stop();
    expect(hub.handlers.get(CONNECTION_INVALIDATION_CHANNEL)?.size).toBe(0);
  });

  it("closes the named user's sockets with 4000 and the reason", () => {
    const mine = fakeSocket();
    const theirs = fakeSocket();

    registerConnection("user-1", mine);
    registerConnection("user-2", theirs);
    startConnectionInvalidation();

    hub.emit(
      CONNECTION_INVALIDATION_CHANNEL,
      envelope({ userId: "user-1", reason: "household-joined" })
    );

    expect(mine.close).toHaveBeenCalledWith(4000, "household-joined");
    expect(theirs.close).not.toHaveBeenCalled();

    unregisterConnection("user-2", theirs);
  });

  it("drops a malformed payload without touching any socket", () => {
    const mine = fakeSocket();

    registerConnection("user-1", mine);
    startConnectionInvalidation();

    hub.emit(CONNECTION_INVALIDATION_CHANNEL, envelope({ userId: 42 }));

    expect(mine.close).not.toHaveBeenCalled();
    unregisterConnection("user-1", mine);
  });
});
