/**
 * Valkey connection singleton across duplicate module instances.
 *
 * This module is evaluated more than once per process — development resolves
 * `@norish/shared-server/*` through the app's path alias into the source tree
 * from one import chain and through the node_modules copy from another. A
 * "singleton" held in a module-local is then one connection per instance, and
 * shutdown closes only whichever one it can see.
 *
 * `vi.resetModules()` reproduces that: the next import evaluates the module
 * afresh, exactly as a second resolution would.
 */

// @vitest-environment node

import type { RedisOptions } from "ioredis";
import { beforeEach, describe, expect, it, vi } from "vitest";

const constructed: RedisOptions[] = [];
const ping = vi.fn();

class MockValkey {
  status = "ready";

  constructor(options: RedisOptions) {
    constructed.push(options);
  }

  on = vi.fn();
  ping = ping;
  connect = vi.fn().mockResolvedValue(undefined);
  disconnect = vi.fn().mockImplementation(function (this: MockValkey) {
    this.status = "end";
  });
  removeAllListeners = vi.fn();
  duplicate = vi.fn(() => ({ on: vi.fn(), status: "ready" }));
}

vi.mock("ioredis", () => ({ default: MockValkey, Redis: MockValkey }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { VALKEY_URL: "valkey://:secret@valkey.local:6380/3" },
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  redactUrl: (url: string) => url,
}));

beforeEach(() => {
  constructed.length = 0;

  const globalForValkey = globalThis as unknown as Record<string, unknown>;

  delete globalForValkey.publisherClient;
});

describe("publisher connection", () => {
  it("hands the same connection to a second module instance", async () => {
    vi.resetModules();
    const first = await import("../../src/valkey/client");

    vi.resetModules();
    const second = await import("../../src/valkey/client");

    expect(await second.getPublisherClient()).toBe(await first.getPublisherClient());
    expect(constructed).toHaveLength(1);
  });

  it("does not race two instances into two connections", async () => {
    vi.resetModules();
    const first = await import("../../src/valkey/client");

    vi.resetModules();
    const second = await import("../../src/valkey/client");

    // Both ask before either has finished connecting, which is what startup
    // does when two import chains reach Valkey at once.
    const [a, b] = await Promise.all([first.getPublisherClient(), second.getPublisherClient()]);

    expect(a).toBe(b);
    expect(constructed).toHaveLength(1);
  });

  it("lets any instance close the connection the other opened", async () => {
    vi.resetModules();
    const opener = await import("../../src/valkey/client");

    vi.resetModules();
    const closer = await import("../../src/valkey/client");

    const client = await opener.getPublisherClient();

    await closer.closeValkeyConnections();

    expect(client.disconnect).toHaveBeenCalledOnce();
  });

  it("duplicates the publisher for a subscriber instead of opening a second publisher", async () => {
    vi.resetModules();
    const { createSubscriberClient, getPublisherClient } = await import("../../src/valkey/client");

    const publisher = await getPublisherClient();
    const subscriber = await createSubscriberClient();

    expect(publisher.duplicate).toHaveBeenCalledExactlyOnceWith({
      commandTimeout: undefined,
      connectionName: `norish:${process.pid}:realtime-hub`,
    });
    expect(subscriber).not.toBe(publisher);
    expect(constructed).toHaveLength(1);
  });
});

describe("connection options", () => {
  it("connects with the parsed URL and leaves the rest to ioredis 6's defaults", async () => {
    vi.resetModules();
    const { getPublisherClient } = await import("../../src/valkey/client");

    await getPublisherClient();

    expect(constructed[0]).toMatchObject({
      host: "valkey.local",
      port: 6380,
      password: "secret",
      db: 3,
      maxRetriesPerRequest: null,
      commandTimeout: 5_000,
      disconnectTimeout: 200,
      socketTimeout: 10_000,
      connectionName: `norish:${process.pid}:publisher`,
    });
    // RESP3, reconnecting for ever with capped backoff, a 30 s keep-alive.
    for (const option of ["protocol", "retryStrategy", "keepAlive", "connectTimeout"] as const) {
      expect(constructed[0]).not.toHaveProperty(option);
    }
  });
});

describe("Valkey health", () => {
  it("is ok when the ping answers", async () => {
    vi.resetModules();
    const { getValkeyHealth } = await import("../../src/valkey/client");

    ping.mockResolvedValueOnce("PONG");

    await expect(getValkeyHealth()).resolves.toEqual({ status: "ok" });
  });

  it("is an error when the ping fails", async () => {
    vi.resetModules();
    const { getValkeyHealth } = await import("../../src/valkey/client");

    ping.mockRejectedValueOnce(new Error("Command timed out"));

    await expect(getValkeyHealth()).resolves.toEqual({ status: "error" });
  });

  it("is an error when the ping has not answered after two seconds", async () => {
    vi.resetModules();
    const { getValkeyHealth } = await import("../../src/valkey/client");

    ping.mockReturnValueOnce(new Promise(() => {}));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    try {
      const health = getValkeyHealth();

      await vi.advanceTimersByTimeAsync(1_999);
      await vi.advanceTimersByTimeAsync(1);

      await expect(health).resolves.toEqual({ status: "error" });
    } finally {
      vi.useRealTimers();
    }
  });
});
