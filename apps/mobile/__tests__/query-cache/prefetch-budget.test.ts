import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  _reset,
  add,
  has,
  MAX_PREFETCHED_RECIPES,
  snapshot,
} from "../../src/lib/query-cache/prefetch-budget";

vi.mock("@norish/shared/lib/logger", () => ({
  createClientLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

function makeQueryClient() {
  return {
    removeQueries: vi.fn(),
  } as any;
}

function getQueryKey(id: string) {
  return ["recipes", "get", { id }];
}

describe("prefetch-budget", () => {
  beforeEach(() => {
    _reset();
  });

  it("exports MAX_PREFETCHED_RECIPES as 30", () => {
    expect(MAX_PREFETCHED_RECIPES).toBe(30);
  });

  describe("has()", () => {
    it("returns false for untracked IDs", () => {
      expect(has("unknown")).toBe(false);
    });

    it("returns true after adding an ID", () => {
      const qc = makeQueryClient();

      add("r1", qc, getQueryKey);

      expect(has("r1")).toBe(true);
    });
  });

  describe("add()", () => {
    it("tracks IDs in insertion order", () => {
      const qc = makeQueryClient();

      add("a", qc, getQueryKey);
      add("b", qc, getQueryKey);
      add("c", qc, getQueryKey);

      expect(snapshot()).toEqual(["a", "b", "c"]);
    });

    it("moves a re-added ID to the end (LRU refresh)", () => {
      const qc = makeQueryClient();

      add("a", qc, getQueryKey);
      add("b", qc, getQueryKey);
      add("a", qc, getQueryKey);

      expect(snapshot()).toEqual(["b", "a"]);
    });

    it("does not exceed MAX_PREFETCHED_RECIPES", () => {
      const qc = makeQueryClient();

      for (let i = 0; i < MAX_PREFETCHED_RECIPES + 5; i++) {
        add(`r${i}`, qc, getQueryKey);
      }

      expect(snapshot()).toHaveLength(MAX_PREFETCHED_RECIPES);
    });

    it("evicts the oldest entry first (LRU order)", () => {
      const qc = makeQueryClient();

      // Fill to capacity
      for (let i = 0; i < MAX_PREFETCHED_RECIPES; i++) {
        add(`r${i}`, qc, getQueryKey);
      }

      expect(has("r0")).toBe(true);

      // Adding one more should evict r0
      add("new", qc, getQueryKey);

      expect(has("r0")).toBe(false);
      expect(has("new")).toBe(true);
      expect(snapshot()).toHaveLength(MAX_PREFETCHED_RECIPES);
    });

    it("calls queryClient.removeQueries for evicted entries", () => {
      const qc = makeQueryClient();

      for (let i = 0; i < MAX_PREFETCHED_RECIPES; i++) {
        add(`r${i}`, qc, getQueryKey);
      }

      qc.removeQueries.mockClear();

      add("overflow", qc, getQueryKey);

      expect(qc.removeQueries).toHaveBeenCalledWith({
        queryKey: getQueryKey("r0"),
        exact: true,
      });
    });

    it("does not call removeQueries when under budget", () => {
      const qc = makeQueryClient();

      add("r1", qc, getQueryKey);
      add("r2", qc, getQueryKey);

      expect(qc.removeQueries).not.toHaveBeenCalled();
    });
  });

  describe("snapshot()", () => {
    it("returns a copy (mutations do not affect internal state)", () => {
      const qc = makeQueryClient();

      add("a", qc, getQueryKey);

      const snap = snapshot() as string[];
      snap.push("tampered");

      expect(snapshot()).toEqual(["a"]);
    });
  });
});
