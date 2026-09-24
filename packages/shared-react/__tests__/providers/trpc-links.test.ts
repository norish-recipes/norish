/**
 * The WebSocket transport's reconnect policy and close handling, with
 * `createWSClient` replaced by a recorder of the options it was given.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RecordedWsClient = {
  options: {
    retryDelayMs: (attemptIndex: number) => number;
    onOpen: () => void;
    onClose: (cause: unknown) => void;
  };
  close: ReturnType<typeof vi.fn>;
};

const wsClients = vi.hoisted(() => [] as RecordedWsClient[]);

vi.mock("@trpc/client", async () => {
  const actual = await vi.importActual<typeof import("@trpc/client")>("@trpc/client");

  return {
    ...actual,
    createWSClient: vi.fn((options: RecordedWsClient["options"]) => {
      const client = { options, close: vi.fn(async () => undefined) };

      wsClients.push(client);

      return client;
    }),
  };
});

const {
  createTRPCClientLinks,
  isUnauthorizedTRPCError,
  isUnauthorizedWebSocketClose,
  webSocketRetryDelayMs,
} = await import("../../src/providers/trpc-links");

const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn() };

function createLinks(overrides: Record<string, unknown> = {}) {
  const onWebSocketClose = vi.fn();
  const onWebSocketUnauthorized = vi.fn();
  const onWebSocketOpen = vi.fn();

  createTRPCClientLinks({
    logger,
    getBaseUrl: () => "http://localhost:3000",
    getWsUrl: () => "ws://localhost:3000/trpc",
    onWebSocketClose,
    onWebSocketUnauthorized,
    onWebSocketOpen,
    ...overrides,
  });

  const client = wsClients.at(-1);

  if (!client) throw new Error("createWSClient was not called");

  return { client, onWebSocketClose, onWebSocketUnauthorized, onWebSocketOpen };
}

beforeEach(() => {
  wsClients.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("webSocketRetryDelayMs", () => {
  it("stays within [0, min(30000, 1000·2^n)] for attempts 0..6 and is not constant", () => {
    const delays = [0, 1, 2, 3, 4, 5, 6].map((attempt) => webSocketRetryDelayMs(attempt));

    delays.forEach((delay, attempt) => {
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(Math.min(30_000, 1_000 * 2 ** attempt));
    });
    expect(new Set(delays).size).toBeGreaterThan(1);
  });

  it("is the injected RNG times the doubling ceiling, capped at 30 s", () => {
    expect(webSocketRetryDelayMs(0, () => 1)).toBe(1_000);
    expect(webSocketRetryDelayMs(3, () => 0.5)).toBe(4_000);
    expect(webSocketRetryDelayMs(10, () => 1)).toBe(30_000);
    expect(webSocketRetryDelayMs(5, () => 0)).toBe(0);
  });
});

describe("the WebSocket client", () => {
  it("retries with the injected RNG's jitter", () => {
    const { client } = createLinks({ retryRandom: () => 0.25 });

    expect(client.options.retryDelayMs(0)).toBe(250);
    expect(client.options.retryDelayMs(2)).toBe(1_000);
    expect(client.close).not.toHaveBeenCalled();
  });

  it("on 4401 stops the client, fires onWebSocketUnauthorized once, and still reports the close", () => {
    const { client, onWebSocketClose, onWebSocketUnauthorized } = createLinks();

    client.options.onClose({ code: 4401, reason: "Unauthorized" });
    client.options.onClose({ code: 4401, reason: "Unauthorized" });

    expect(client.close).toHaveBeenCalledTimes(1);
    expect(onWebSocketUnauthorized).toHaveBeenCalledTimes(1);
    expect(onWebSocketClose).toHaveBeenCalledTimes(2);
    expect(client.options.retryDelayMs(0)).toBe(0);
  });

  it.each([1012, 1006])("keeps retrying after a %s close", (code) => {
    const { client, onWebSocketClose, onWebSocketUnauthorized } = createLinks({
      retryRandom: () => 1,
    });

    client.options.onClose({ code, reason: "" });

    expect(client.close).not.toHaveBeenCalled();
    expect(onWebSocketUnauthorized).not.toHaveBeenCalled();
    expect(onWebSocketClose).toHaveBeenCalledWith({ code, reason: "" });
    expect(client.options.retryDelayMs(1)).toBe(2_000);
  });

  it("reports a normal 1000 close too", () => {
    const { client, onWebSocketClose } = createLinks();

    client.options.onClose({ code: 1000, reason: "" });

    expect(onWebSocketClose).toHaveBeenCalledWith({ code: 1000, reason: "" });
    expect(client.close).not.toHaveBeenCalled();
  });

  it("latches the unauthorized close per client instance: a new client retries normally", () => {
    const first = createLinks();

    first.client.options.onClose({ code: 4401, reason: "Unauthorized" });
    expect(first.client.options.retryDelayMs(0)).toBe(0);

    const second = createLinks({ retryRandom: () => 1 });

    expect(second.client).not.toBe(first.client);
    expect(second.client.options.retryDelayMs(0)).toBe(1_000);
    expect(second.onWebSocketUnauthorized).not.toHaveBeenCalled();
  });

  it("does not detect unauthorized from a reason string, only from 4401", () => {
    expect(isUnauthorizedWebSocketClose({ code: 4401 })).toBe(true);
    expect(isUnauthorizedWebSocketClose({ _code: 4401 })).toBe(true);
    expect(isUnauthorizedWebSocketClose({ code: 1006, reason: "401 Unauthorized" })).toBe(false);
    expect(isUnauthorizedWebSocketClose({ _code: 1006, _reason: "unauthorized" })).toBe(false);
    expect(isUnauthorizedWebSocketClose(null)).toBe(false);
  });
});

describe("isUnauthorizedTRPCError", () => {
  it("reads the error code or status, never the message", () => {
    expect(isUnauthorizedTRPCError({ data: { code: "UNAUTHORIZED", httpStatus: 401 } })).toBe(true);
    expect(isUnauthorizedTRPCError({ shape: { data: { httpStatus: 401 } } })).toBe(true);
    expect(isUnauthorizedTRPCError({ data: { code: "FORBIDDEN", httpStatus: 403 } })).toBe(false);
    expect(isUnauthorizedTRPCError({ message: "401 unauthorized" })).toBe(false);
    expect(isUnauthorizedTRPCError(null)).toBe(false);
  });
});
