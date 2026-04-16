import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeRetryDelay,
  isProcessing,
  processQueue,
  setReplayFn,
} from "../../src/lib/outbox/outbox-replay";
import * as outboxStore from "../../src/lib/outbox/outbox-store";

// ---------------------------------------------------------------------------
// Mock MMKV storage
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

describe("outbox-replay", () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.useRealTimers();
    // Reset the replay function before each test
    setReplayFn(vi.fn());
  });

  describe("computeRetryDelay", () => {
    it("uses exponential backoff", () => {
      expect(computeRetryDelay(0)).toBe(2_000);
      expect(computeRetryDelay(1)).toBe(4_000);
      expect(computeRetryDelay(2)).toBe(8_000);
      expect(computeRetryDelay(3)).toBe(16_000);
    });

    it("caps at 60 seconds", () => {
      expect(computeRetryDelay(10)).toBe(60_000);
      expect(computeRetryDelay(20)).toBe(60_000);
    });
  });

  describe("processQueue", () => {
    it("removes items on successful replay", async () => {
      const replayFn = vi.fn().mockResolvedValue(true);

      setReplayFn(replayFn);

      outboxStore.enqueue("recipes.update", '"data"');

      expect(outboxStore.size()).toBe(1);

      await processQueue();

      expect(replayFn).toHaveBeenCalledTimes(1);
      expect(outboxStore.size()).toBe(0);
    });

    it("replays items in insertion order", async () => {
      const replayedPaths: string[] = [];

      setReplayFn(async (item) => {
        replayedPaths.push(item.path);

        return true;
      });

      outboxStore.enqueue("first", '"1"');
      outboxStore.enqueue("second", '"2"');
      outboxStore.enqueue("third", '"3"');

      await processQueue();

      expect(replayedPaths).toEqual(["first", "second", "third"]);
    });

    it("increments delay metadata on failed attempts", async () => {
      setReplayFn(vi.fn().mockResolvedValue(false));

      outboxStore.enqueue("recipes.update", '"data"');

      await processQueue();

      const items = outboxStore.loadAll();

      expect(items).toHaveLength(1);
      expect(items[0].attempts).toBe(1);
      expect(items[0].nextRetryAt).toBeDefined();
    });

    it("stops processing on first failure", async () => {
      const replayFn = vi
        .fn()
        .mockResolvedValueOnce(true) // first item succeeds
        .mockResolvedValueOnce(false); // second item fails

      setReplayFn(replayFn);

      outboxStore.enqueue("first", '"1"');
      outboxStore.enqueue("second", '"2"');
      outboxStore.enqueue("third", '"3"');

      await processQueue();

      // First was replayed and removed, second was tried and failed, third was skipped
      expect(replayFn).toHaveBeenCalledTimes(2);

      const remaining = outboxStore.loadAll();

      expect(remaining).toHaveLength(2);
      expect(remaining[0].path).toBe("second");
      expect(remaining[0].attempts).toBe(1);
      expect(remaining[1].path).toBe("third");
      expect(remaining[1].attempts).toBe(0);
    });

    it("skips items not yet eligible for retry", async () => {
      const replayFn = vi.fn().mockResolvedValue(true);

      setReplayFn(replayFn);

      // Enqueue an item with a future retry time
      const item = outboxStore.enqueue("recipes.update", '"data"');

      outboxStore.update(item.id, {
        nextRetryAt: new Date(Date.now() + 999_999).toISOString(),
      });

      await processQueue();

      expect(replayFn).not.toHaveBeenCalled();
      expect(outboxStore.size()).toBe(1);
    });

    it("does not run concurrently", async () => {
      let resolveReplay: () => void;
      const replayPromise = new Promise<boolean>((resolve) => {
        resolveReplay = () => resolve(true);
      });

      setReplayFn(() => replayPromise);

      outboxStore.enqueue("recipes.update", '"data"');

      const firstPass = processQueue();

      // isProcessing should be true while processing
      expect(isProcessing()).toBe(true);

      // Second call should be a no-op
      const secondPass = processQueue();

      resolveReplay!();

      await firstPass;
      await secondPass;

      expect(isProcessing()).toBe(false);
    });

    it("does nothing when queue is empty", async () => {
      const replayFn = vi.fn();

      setReplayFn(replayFn);

      await processQueue();

      expect(replayFn).not.toHaveBeenCalled();
    });

    it("schedules another pass after a failed replay delay elapses", async () => {
      vi.useFakeTimers();

      const replayFn = vi
        .fn<(_: unknown) => Promise<boolean>>()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      setReplayFn(replayFn);

      outboxStore.enqueue("recipes.update", '"data"');

      await processQueue();

      expect(replayFn).toHaveBeenCalledTimes(1);
      expect(outboxStore.size()).toBe(1);

      await vi.advanceTimersByTimeAsync(4_000);

      expect(replayFn).toHaveBeenCalledTimes(2);
      expect(outboxStore.size()).toBe(0);
    });
  });
});
