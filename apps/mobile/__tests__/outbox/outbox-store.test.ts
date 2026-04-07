import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("outbox-store", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  describe("enqueue", () => {
    it("persists a new item to storage", () => {
      const item = outboxStore.enqueue("recipes.update", '{"json":{"id":"1"}}', {
        operationId: "op-123",
        headers: { "x-operation-id": "op-123" },
      });

      expect(item.path).toBe("recipes.update");
      expect(item.input).toBe('{"json":{"id":"1"}}');
      expect(item.request).toEqual({
        operationId: "op-123",
        headers: { "x-operation-id": "op-123" },
      });
      expect(item.attempts).toBe(0);
      expect(item.nextRetryAt).toBeNull();
      expect(item.id).toBeDefined();
      expect(item.createdAt).toBeDefined();
    });

    it("appends items in order", () => {
      outboxStore.enqueue("recipes.update", '"a"');
      outboxStore.enqueue("recipes.delete", '"b"');

      const items = outboxStore.loadAll();

      expect(items).toHaveLength(2);
      expect(items[0].path).toBe("recipes.update");
      expect(items[1].path).toBe("recipes.delete");
    });

    it("survives simulated reload (reads from same storage)", () => {
      outboxStore.enqueue("recipes.create", '"payload"');

      // Simulate fresh module reading the same storage
      const items = outboxStore.loadAll();

      expect(items).toHaveLength(1);
      expect(items[0].path).toBe("recipes.create");
    });
  });

  describe("loadAll", () => {
    it("returns empty array when no items stored", () => {
      expect(outboxStore.loadAll()).toEqual([]);
    });

    it("resets on corrupt data", () => {
      mockStorage.set("outbox-queue", "not-json{{{");

      const items = outboxStore.loadAll();

      expect(items).toEqual([]);
      expect(mockStorage.has("outbox-queue")).toBe(false);
    });
  });

  describe("update", () => {
    it("patches an existing item", () => {
      const item = outboxStore.enqueue("recipes.update", '"data"');

      outboxStore.update(item.id, {
        attempts: 3,
        nextRetryAt: "2026-01-01T00:00:00.000Z",
      });

      const items = outboxStore.loadAll();

      expect(items[0].attempts).toBe(3);
      expect(items[0].nextRetryAt).toBe("2026-01-01T00:00:00.000Z");
      // Other fields unchanged
      expect(items[0].path).toBe("recipes.update");
    });

    it("is a no-op for unknown ID", () => {
      outboxStore.enqueue("recipes.update", '"data"');
      outboxStore.update("nonexistent", { attempts: 99 });

      const items = outboxStore.loadAll();

      expect(items[0].attempts).toBe(0);
    });
  });

  describe("remove", () => {
    it("removes an item by ID", () => {
      const item = outboxStore.enqueue("recipes.update", '"data"');

      outboxStore.remove(item.id);

      expect(outboxStore.loadAll()).toEqual([]);
    });

    it("preserves other items", () => {
      const first = outboxStore.enqueue("recipes.update", '"a"');

      outboxStore.enqueue("recipes.delete", '"b"');
      outboxStore.remove(first.id);

      const items = outboxStore.loadAll();

      expect(items).toHaveLength(1);
      expect(items[0].path).toBe("recipes.delete");
    });
  });

  describe("size", () => {
    it("returns 0 for empty queue", () => {
      expect(outboxStore.size()).toBe(0);
    });

    it("returns count of items", () => {
      outboxStore.enqueue("a", '"1"');
      outboxStore.enqueue("b", '"2"');

      expect(outboxStore.size()).toBe(2);
    });
  });
});
