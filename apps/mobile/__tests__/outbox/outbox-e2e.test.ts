import { beforeEach, describe, expect, it, vi } from "vitest";

import { getOutboxDiagnostics } from "../../src/lib/outbox/outbox-diagnostics";
import { computeRetryDelay, processQueue, setReplayFn } from "../../src/lib/outbox/outbox-replay";
import * as outboxStore from "../../src/lib/outbox/outbox-store";

// ---------------------------------------------------------------------------
// Mock MMKV storage (simulates durable persistence across "restarts")
// ---------------------------------------------------------------------------

const mockStorage = new Map<string, string>();

vi.mock("@/lib/storage/outbox-mmkv", () => ({
  outboxStorage: {
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string) => mockStorage.set(key, value),
    delete: (key: string) => mockStorage.delete(key),
  },
}));

vi.mock("@norish/shared/lib/logger", () => ({
  createClientLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("outbox end-to-end flow", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("simulates offline mutation failure → app restart → reconnect → queue drain", async () => {
    // Step 1: User performs a mutation while offline — it fails and gets enqueued
    outboxStore.enqueue("recipes.update", '{"json":{"id":"recipe-1","title":"Updated"}}');
    outboxStore.enqueue("groceries.add", '{"json":{"name":"Milk","quantity":2}}');

    expect(outboxStore.size()).toBe(2);

    // Step 2: Simulate app restart — storage persists, module reloads
    // (In our test the Map-based mock persists across calls)
    const afterRestart = outboxStore.loadAll();

    expect(afterRestart).toHaveLength(2);
    expect(afterRestart[0].path).toBe("recipes.update");
    expect(afterRestart[1].path).toBe("groceries.add");

    // Step 3: Backend is still unreachable — replay fails
    const replayFn = vi.fn().mockResolvedValue(false);

    setReplayFn(replayFn);

    await processQueue();

    // First item was attempted and failed; processing stopped
    expect(replayFn).toHaveBeenCalledTimes(1);

    const afterFirstAttempt = outboxStore.loadAll();

    expect(afterFirstAttempt[0].attempts).toBe(1);
    expect(afterFirstAttempt[0].nextRetryAt).toBeDefined();
    expect(afterFirstAttempt[1].attempts).toBe(0); // second item not attempted

    // Step 4: Try again immediately — first item not yet eligible
    replayFn.mockClear();

    await processQueue();

    // First item is skipped due to retry delay, second is attempted
    expect(replayFn).toHaveBeenCalledTimes(1);
    expect(replayFn.mock.calls[0][0].path).toBe("groceries.add");

    // Second item also fails
    const afterSecondPass = outboxStore.loadAll();

    expect(afterSecondPass).toHaveLength(2);

    // Step 5: Backend comes back — manually reset retry times to simulate elapsed time
    outboxStore.update(afterSecondPass[0].id, { nextRetryAt: null });
    outboxStore.update(afterSecondPass[1].id, { nextRetryAt: null });

    replayFn.mockClear();
    replayFn.mockResolvedValue(true); // Now everything succeeds

    await processQueue();

    // Both items should be replayed and removed
    expect(replayFn).toHaveBeenCalledTimes(2);
    expect(outboxStore.size()).toBe(0);
  });

  it("diagnostics reflect queue state accurately", async () => {
    // Empty queue
    let diag = getOutboxDiagnostics();

    expect(diag.queueLength).toBe(0);
    expect(diag.isReplaying).toBe(false);
    expect(diag.oldestItemAt).toBeNull();
    expect(diag.byPath).toEqual({});

    // Add items
    outboxStore.enqueue("recipes.update", '"a"');
    outboxStore.enqueue("recipes.update", '"b"');
    outboxStore.enqueue("groceries.add", '"c"');

    diag = getOutboxDiagnostics();

    expect(diag.queueLength).toBe(3);
    expect(diag.isReplaying).toBe(false);
    expect(diag.oldestItemAt).toBeDefined();
    expect(diag.byPath).toEqual({
      "recipes.update": 2,
      "groceries.add": 1,
    });

    // Drain
    setReplayFn(vi.fn().mockResolvedValue(true));

    await processQueue();

    diag = getOutboxDiagnostics();

    expect(diag.queueLength).toBe(0);
  });

  it("drops queued items after the second replay failure", async () => {
    outboxStore.enqueue("test.mutation", '"payload"');

    setReplayFn(vi.fn().mockResolvedValue(false));

    // First failure
    await processQueue();

    let items = outboxStore.loadAll();

    expect(items[0].attempts).toBe(1);

    // Reset retry time to make it eligible again
    outboxStore.update(items[0].id, { nextRetryAt: null });

    // Second failure
    await processQueue();

    expect(outboxStore.size()).toBe(0);

    // Verify computed delays match expected exponential pattern
    expect(computeRetryDelay(0)).toBe(2_000);
    expect(computeRetryDelay(1)).toBe(4_000);
    expect(computeRetryDelay(2)).toBe(8_000);
    expect(computeRetryDelay(5)).toBe(60_000); // 2000 * 2^5 = 64000, capped to 60000
  });

  it("drops an item after two replay failures and continues draining later items", async () => {
    outboxStore.enqueue("recipes.update", '"first"');
    outboxStore.enqueue("recipes.delete", '"second"');

    const replayFn = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    setReplayFn(replayFn);

    await processQueue();

    let items = outboxStore.loadAll();

    expect(items).toHaveLength(2);
    expect(items[0].attempts).toBe(1);
    expect(items[1].attempts).toBe(0);

    outboxStore.update(items[0].id, { nextRetryAt: null });

    await processQueue();

    items = outboxStore.loadAll();

    expect(replayFn).toHaveBeenCalledTimes(3);
    expect(items).toHaveLength(0);
  });
});
