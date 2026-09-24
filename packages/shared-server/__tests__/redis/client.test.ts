/**
 * Redis connection singleton across duplicate module instances.
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

class MockRedis {
  status = "ready";

  constructor(options: RedisOptions) {
    constructed.push(options);
  }

  on = vi.fn();
  connect = vi.fn().mockResolvedValue(undefined);
  quit = vi.fn().mockImplementation(function (this: MockRedis) {
    this.status = "end";

    return Promise.resolve();
  });
  removeAllListeners = vi.fn();
  duplicate = vi.fn(() => ({ on: vi.fn(), status: "ready" }));
}

vi.mock("ioredis", () => ({ default: MockRedis, Redis: MockRedis }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { REDIS_URL: "redis://:secret@redis.local:6380/3" },
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

  const globalForRedis = globalThis as unknown as Record<string, unknown>;

  delete globalForRedis.publisherClient;
  delete globalForRedis.connectionPromise;
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

  it("duplicates the publisher for a subscriber instead of opening a second publisher", async () => {
    vi.resetModules();
    const { createSubscriberClient, getPublisherClient } = await import("../../src/redis/client");

    const publisher = await getPublisherClient();
    const subscriber = await createSubscriberClient();

    expect(publisher.duplicate).toHaveBeenCalledOnce();
    expect(subscriber).not.toBe(publisher);
    expect(constructed).toHaveLength(1);
  });
});

describe("connection options", () => {
  it("connects with the parsed URL and BullMQ's keep-alive and connect timeout", async () => {
    vi.resetModules();
    const { getPublisherClient } = await import("../../src/redis/client");

    await getPublisherClient();

    expect(constructed[0]).toMatchObject({
      host: "redis.local",
      port: 6380,
      password: "secret",
      db: 3,
      keepAlive: 30_000,
      connectTimeout: 10_000,
      maxRetriesPerRequest: null,
    });
    expect(constructed[0]!.retryStrategy).toBeTypeOf("function");
  });

  it("backs off exponentially, caps at 5 s and never gives up", async () => {
    vi.resetModules();
    const { redisRetryStrategy, REDIS_RETRY_MAX_DELAY_MS } = await import("../../src/redis/client");

    expect(REDIS_RETRY_MAX_DELAY_MS).toBe(5_000);
    expect(redisRetryStrategy(1)).toBe(1_000);
    expect(redisRetryStrategy(2)).toBe(2_000);
    expect(redisRetryStrategy(3)).toBe(4_000);
    expect(redisRetryStrategy(4)).toBe(5_000);

    for (const times of [5, 20, 21, 100, 10_000]) {
      const delay = redisRetryStrategy(times);

      expect(delay).not.toBeNull();
      expect(delay).toBe(5_000);
    }
  });
});
