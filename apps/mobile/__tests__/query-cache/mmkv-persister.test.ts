import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMmkvPersister } from "../../src/lib/query-cache/mmkv-persister";

// Mock MMKV
const mockSet = vi.fn();
const mockGetString = vi.fn();
const mockDelete = vi.fn();
const mockClearAll = vi.fn();

vi.mock("@/lib/storage/query-cache-mmkv", () => ({
  queryCacheStorage: {
    set: (...args: unknown[]) => mockSet(...args),
    getString: (...args: unknown[]) => mockGetString(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    clearAll: () => mockClearAll(),
  },
}));

vi.mock("@norish/shared/lib/logger", () => ({
  createClientLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("mmkv-persister", () => {
  let persister: ReturnType<typeof createMmkvPersister>;

  beforeEach(() => {
    vi.clearAllMocks();
    persister = createMmkvPersister();
  });

  describe("persistClient", () => {
    it("serializes and stores the client state", () => {
      const client = {
        timestamp: Date.now(),
        buster: "1.0.0",
        clientState: { mutations: [], queries: [] },
      };

      persister.persistClient(client);

      expect(mockSet).toHaveBeenCalledWith("tanstack-query-cache", JSON.stringify(client));
    });

    it("catches errors without throwing", () => {
      mockSet.mockImplementation(() => {
        throw new Error("write failed");
      });

      expect(() =>
        persister.persistClient({
          timestamp: Date.now(),
          buster: "1.0.0",
          clientState: { mutations: [], queries: [] },
        })
      ).not.toThrow();
    });
  });

  describe("restoreClient", () => {
    it("returns undefined when no cached data exists", () => {
      mockGetString.mockReturnValue(undefined);

      expect(persister.restoreClient()).toBeUndefined();
    });

    it("deserializes and returns stored client state", () => {
      const client = {
        timestamp: Date.now(),
        buster: "1.0.0",
        clientState: { mutations: [], queries: [] },
      };

      mockGetString.mockReturnValue(JSON.stringify(client));

      const restored = persister.restoreClient();

      expect(restored).toEqual(client);
    });

    it("handles corrupt data gracefully and clears storage", () => {
      mockGetString.mockReturnValue("not-valid-json{{{");

      const result = persister.restoreClient();

      expect(result).toBeUndefined();
      expect(mockDelete).toHaveBeenCalledWith("tanstack-query-cache");
    });

    it("handles read errors gracefully and clears storage", () => {
      mockGetString.mockImplementation(() => {
        throw new Error("read failed");
      });

      expect(persister.restoreClient()).toBeUndefined();
      expect(mockDelete).toHaveBeenCalledWith("tanstack-query-cache");
    });
  });

  describe("removeClient", () => {
    it("deletes the stored data", () => {
      persister.removeClient();

      expect(mockDelete).toHaveBeenCalledWith("tanstack-query-cache");
    });

    it("catches errors without throwing", () => {
      mockDelete.mockImplementation(() => {
        throw new Error("delete failed");
      });

      expect(() => persister.removeClient()).not.toThrow();
    });
  });

  describe("round-trip", () => {
    it("persisted data can be restored", () => {
      let stored: string | undefined;

      mockSet.mockImplementation((_key: string, value: string) => {
        stored = value;
      });
      mockGetString.mockImplementation(() => stored);

      const original = {
        timestamp: Date.now(),
        buster: "2.0.0",
        clientState: {
          mutations: [],
          queries: [
            {
              queryKey: ["test"],
              queryHash: '["test"]',
              state: { data: { hello: "world" }, status: "success" },
            },
          ],
        },
      };

      persister.persistClient(original as any);
      const restored = persister.restoreClient();

      expect(restored).toEqual(original);
    });
  });
});
