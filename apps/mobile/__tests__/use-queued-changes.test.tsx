// @vitest-environment jsdom
import { useQueuedChanges } from "@/hooks/use-queued-changes";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const listeners = new Set<() => void>();
const account = { owner: "a", count: 2 };

vi.mock("@/lib/offline/engine", () => ({
  offlineEngine: {
    cache: {
      owner: () => account.owner,
      subscribe: (listener: () => void) => {
        listeners.add(listener);

        return () => listeners.delete(listener);
      },
    },
    outbox: { subscribe: () => () => undefined },
    unsyncedChanges: async () => account.count,
  },
}));

describe("useQueuedChanges", () => {
  it("re-reads the count when the cache owner changes", async () => {
    const { result } = renderHook(() => useQueuedChanges());

    await waitFor(() => expect(result.current).toBe(2));

    account.owner = "b";
    account.count = 0;
    act(() => listeners.forEach((listener) => listener()));

    await waitFor(() => expect(result.current).toBe(0));
  });
});
