/**
 * Queue registry lifecycle.
 *
 * The registry has to be process-global rather than module-local, because this
 * file is genuinely evaluated more than once per process: development resolves
 * `@norish/queue/registry` through the app's path alias into the source tree
 * from one import chain and through the node_modules copy from another. A
 * module-local `registry` captured at load time leaves every instance that
 * loaded before initialization permanently empty, which is what made automatic
 * enrichment enrollment report "Queue registry not initialized" for every kind
 * while the queues themselves were running.
 *
 * `vi.resetModules()` reproduces that faithfully: the next import evaluates the
 * module afresh, exactly as a second resolution would.
 */

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    constructor(public name: string) {}

    add = vi.fn();
    addBulk = vi.fn();
    close = vi.fn();
  },
  Worker: class MockWorker {},
  Job: class MockJob {},
}));

vi.mock("@norish/queue/redis/bullmq", () => ({
  getBullClient: () => ({}),
}));

vi.mock("@norish/db/repositories/server-config", () => ({
  getConfig: vi.fn().mockResolvedValue(null),
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

type RegistryModule = typeof import("../../src/registry");

/** A freshly evaluated copy of the registry module — a second resolution. */
async function loadRegistryInstance(): Promise<RegistryModule> {
  vi.resetModules();

  return await import("../../src/registry");
}

beforeEach(() => {
  const globalForRegistry = globalThis as unknown as Record<string, unknown>;

  delete globalForRegistry.queueRegistry;
  delete globalForRegistry.queueRegistryInitializing;
});

describe("queue registry", () => {
  it("serves the queues to a module instance that loaded before initialization", async () => {
    // Both instances exist before anything is initialized, which is the real
    // startup order: the whole import graph is evaluated, then queues are made.
    const initializer = await loadRegistryInstance();
    const consumer = await loadRegistryInstance();

    await initializer.initializeQueues();

    // The consumer never called initializeQueues itself and never will —
    // enrollment reaches it through the coordinator, not through startup.
    expect(() => consumer.getQueues()).not.toThrow();
    expect(consumer.getQueues().recipeProvenance).toBe(initializer.getQueues().recipeProvenance);
  });

  it("hands every enrichment queue to the second instance by name", async () => {
    const initializer = await loadRegistryInstance();
    const consumer = await loadRegistryInstance();

    await initializer.initializeQueues();

    // The reported failure hit exactly the kinds that reach a queue, so assert
    // the lookup the coordinator actually performs.
    for (const { name, queue } of consumer.getAllQueueEntries()) {
      expect(queue, `no queue for ${name}`).toBeDefined();
    }
  });

  it("does not build a second set of queues when both instances initialize", async () => {
    const first = await loadRegistryInstance();
    const second = await loadRegistryInstance();

    const [a, b] = await Promise.all([first.initializeQueues(), second.initializeQueues()]);

    // Two live sets would mean two Redis connections and two dedup namespaces.
    expect(a).toBe(b);
  });

  it("leaves every instance empty once the queues are closed", async () => {
    const initializer = await loadRegistryInstance();
    const consumer = await loadRegistryInstance();

    await initializer.initializeQueues();
    await initializer.closeAllQueues();

    expect(() => consumer.getQueues()).toThrow(/not initialized/);
  });
});
