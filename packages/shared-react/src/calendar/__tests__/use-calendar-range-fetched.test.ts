import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useCalendarRangeFetched } from "../use-calendar-range-fetched";

const listKey = (input: object) => ["calendar", "listItems", input];

vi.mock("../../trpc", () => ({
  useTRPC: () => ({ calendar: { listItems: { queryKey: listKey } } }),
}));

const range = { startISO: "2026-11-15", endISO: "2026-12-04" };

describe("useCalendarRangeFetched", () => {
  it("is false for a seed and a write into it, true once the range itself is fetched", async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useCalendarRangeFetched(range), {
      wrapper: createTestWrapper(queryClient),
    });

    act(() => void queryClient.setQueryData(listKey(range), []));
    expect(result.current).toBe(false);

    await act(() => queryClient.fetchQuery({ queryKey: listKey(range), queryFn: async () => [] }));
    expect(result.current).toBe(true);
  });

  it("ignores a fetch of another range", async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useCalendarRangeFetched(range), {
      wrapper: createTestWrapper(queryClient),
    });

    await act(() =>
      queryClient.fetchQuery({
        queryKey: listKey({ startISO: "2026-11-01", endISO: "2026-11-30" }),
        queryFn: async () => [],
      })
    );
    expect(result.current).toBe(false);
  });
});
