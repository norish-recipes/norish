/**
 * Redis connection singletons across duplicate module instances.
 *
 * These modules are evaluated more than once per process — development resolves
 * `@norish/queue/*` through the app's path alias into the source tree from one
 * import chain and through the node_modules copy from another. A "singleton"
 * held in a module-local is then one connection per instance, and shutdown
 * closes only whichever one it can see.
 *
 * `vi.resetModules()` reproduces that: the next import evaluates the module
 * afresh, exactly as a second resolution would.
 */

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const constructed: { url?: string }[] = [];

class MockRedis {
  status = "ready";

  constructor(url?: string | object) {
    const record = typeof url === "string" ? { url } : {};

    constructed.push(record);
  }

  on = vi.fn();
  connect = vi.fn().mockResolvedValue(undefined);
  quit = vi.fn().mockImplementation(function (this: MockRedis) {
    this.status = "end";

    return Promise.resolve();
  });
  removeAllListeners = vi.fn();
  duplicate = vi.fn();
}

vi.mock("ioredis", () => ({ default: MockRedis, Redis: MockRedis }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { REDIS_URL: "redis://localhost:6379" },
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  redactUrl: (url: string) => url,
}));

beforeEach(() => {
  constructed.length = 0;

  const globalForRedis = globalThis as unknown as Record<string, unknown>;

  delete globalForRedis.bullClient;
  delete globalForRedis.publisherClient;
  delete globalForRedis.connectionPromise;
});

describe("BullMQ connection", () => {
  it("hands the same connection to a second module instance", async () => {
    vi.resetModules();
    const first = await import("../../src/redis/bullmq");

    vi.resetModules();
    const second = await import("../../src/redis/bullmq");

    expect(second.getBullClient()).toBe(first.getBullClient());
    expect(constructed).toHaveLength(1);
  });

  it("lets any instance close the connection the other opened", async () => {
    vi.resetModules();
    const opener = await import("../../src/redis/bullmq");

    vi.resetModules();
    const closer = await import("../../src/redis/bullmq");

    const client = opener.getBullClient();

    await closer.closeBullConnection();

    expect(client.quit).toHaveBeenCalledOnce();
  });
});

describe("publisher connection", () => {
  it("hands the same connection to a second module instance", async () => {
    vi.resetModules();
    const first = await import("../../src/redis/client");

    vi.resetModules();
    const second = await import("../../src/redis/client");

    expect(await second.getPublisherClient()).toBe(await first.getPublisherClient());
    expect(constructed).toHaveLength(1);
  });

  it("does not race two instances into two connections", async () => {
    vi.resetModules();
    const first = await import("../../src/redis/client");

    vi.resetModules();
    const second = await import("../../src/redis/client");

    // Both ask before either has finished connecting, which is what startup
    // does when two import chains reach Redis at once.
    const [a, b] = await Promise.all([first.getPublisherClient(), second.getPublisherClient()]);

    expect(a).toBe(b);
    expect(constructed).toHaveLength(1);
  });

  it("lets any instance close the connection the other opened", async () => {
    vi.resetModules();
    const opener = await import("../../src/redis/client");

    vi.resetModules();
    const closer = await import("../../src/redis/client");

    const client = await opener.getPublisherClient();

    await closer.closeRedisConnections();

    expect(client.quit).toHaveBeenCalledOnce();
  });
});
