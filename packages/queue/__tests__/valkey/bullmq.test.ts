/**
 * BullMQ connection singleton across duplicate module instances.
 *
 * This module is evaluated more than once per process — development resolves
 * `@norish/queue/*` through the app's path alias into the source tree from one
 * import chain and through the node_modules copy from another. A "singleton"
 * held in a module-local is then one connection per instance, and shutdown
 * closes only whichever one it can see.
 *
 * `vi.resetModules()` reproduces that: the next import evaluates the module
 * afresh, exactly as a second resolution would.
 */

// @vitest-environment node

import type { RedisOptions } from "ioredis";
import { beforeEach, describe, expect, it, vi } from "vitest";

const constructed: RedisOptions[] = [];

class MockValkey {
  status = "ready";

  constructor(options: RedisOptions) {
    constructed.push(options);
  }

  on = vi.fn();
  connect = vi.fn().mockResolvedValue(undefined);
  disconnect = vi.fn().mockImplementation(function (this: MockValkey) {
    this.status = "end";
  });
  removeAllListeners = vi.fn();
  duplicate = vi.fn();
}

vi.mock("ioredis", () => ({ default: MockValkey, Redis: MockValkey }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { VALKEY_URL: "valkeys://worker:hunter2@valkey.local:6380/4" },
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

  delete globalForValkey.bullClient;
});

describe("BullMQ connection", () => {
  it("hands the same connection to a second module instance", async () => {
    vi.resetModules();
    const first = await import("../../src/valkey/bullmq");

    vi.resetModules();
    const second = await import("../../src/valkey/bullmq");

    expect(second.getBullClient()).toBe(first.getBullClient());
    expect(constructed).toHaveLength(1);
  });

  it("lets any instance close the connection the other opened", async () => {
    vi.resetModules();
    const opener = await import("../../src/valkey/bullmq");

    vi.resetModules();
    const closer = await import("../../src/valkey/bullmq");

    const client = opener.getBullClient();

    await closer.closeBullConnection();

    expect(client.disconnect).toHaveBeenCalledOnce();
  });

  it("connects with every part of the URL, TLS and database index included", async () => {
    vi.resetModules();
    const { getBullClient } = await import("../../src/valkey/bullmq");

    getBullClient();

    expect(constructed[0]).toMatchObject({
      host: "valkey.local",
      port: 6380,
      username: "worker",
      password: "hunter2",
      db: 4,
      tls: {},
    });
  });

  it("starts from the shared options and leaves reconnecting and the protocol to ioredis", async () => {
    vi.resetModules();
    const { getBullClient } = await import("../../src/valkey/bullmq");

    getBullClient();

    expect(constructed[0]).toMatchObject({
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: true,
      disconnectTimeout: 200,
      socketTimeout: 15_000,
      connectionName: `norish:${process.pid}:bull`,
    });
    for (const option of ["protocol", "retryStrategy", "keepAlive", "connectTimeout"] as const) {
      expect(constructed[0]).not.toHaveProperty(option);
    }
  });
});
