import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearAllQueryCaches } from "../../src/hooks/use-cache-lifecycle";

// Mock dependencies
const mockClearAll = vi.fn();

vi.mock("@/lib/storage/query-cache-mmkv", () => ({
  queryCacheStorage: {
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

// Mock the persistedQueryClient from trpc-provider as a QueryClient-like object
const mockClear = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("@/providers/trpc-provider", () => ({
  persistedQueryClient: {
    clear: () => mockClear(),
    invalidateQueries: () => mockInvalidateQueries(),
  },
}));

vi.mock("@/context/network-context", () => ({
  useNetworkStatus: vi.fn(() => ({ appOnline: false })),
}));

vi.mock("@/lib/outbox", () => ({
  drainQueue: vi.fn(),
}));

describe("cache hydration and clearing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("clearAllQueryCaches", () => {
    it("clears both in-memory and persisted cache", () => {
      clearAllQueryCaches();

      expect(mockClear).toHaveBeenCalledOnce();
      expect(mockClearAll).toHaveBeenCalledOnce();
    });

    it("can be called multiple times safely", () => {
      clearAllQueryCaches();
      clearAllQueryCaches();

      expect(mockClear).toHaveBeenCalledTimes(2);
      expect(mockClearAll).toHaveBeenCalledTimes(2);
    });
  });
});
