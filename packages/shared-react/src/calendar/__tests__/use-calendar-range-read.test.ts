import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CalendarRange } from "@norish/shared/lib/helpers";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useCalendarCacheHelpers } from "../use-calendar-cache";
import { useCalendarQuery } from "../use-calendar-query";
import { useCalendarRangeRead } from "../use-calendar-range-read";

const listKey = (input?: CalendarRange) =>
  input ? [["calendar", "listItems"], { input, type: "query" }] : [["calendar", "listItems"]];
const fetchRange = vi.fn<(input: CalendarRange) => Promise<unknown[]>>();

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    calendar: {
      listItems: {
        queryKey: listKey,
        queryOptions: (input: CalendarRange, options: object) => ({
          queryKey: listKey(input),
          queryFn: () => fetchRange(input),
          ...options,
        }),
      },
    },
  }),
}));

const range = { startISO: "2026-11-15", endISO: "2026-12-04" };
const nextDay = { startISO: "2026-11-16", endISO: "2026-12-05" };
const item = (id: string, date: string) => ({
  id,
  date,
  slot: "Dinner",
  sortOrder: 0,
  itemType: "recipe",
  recipeId: id,
  title: null,
  recipeName: id,
  version: 1,
});

function renderGate(queryClient = createTestQueryClient(), initial = range) {
  return renderHook(
    ({ r }) => ({
      read: useCalendarRangeRead(r),
      data: useCalendarQuery(r).calendarData,
      cache: useCalendarCacheHelpers(),
    }),
    { wrapper: createTestWrapper(queryClient), initialProps: { r: initial } }
  );
}

const pending = () => new Promise<unknown[]>(() => {});

describe("useCalendarRangeRead", () => {
  it("opens on a restored read with no fetch in this run, and a write keeps it open", async () => {
    fetchRange.mockReset().mockImplementation(pending);
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(listKey(range), [item("a", "2026-11-15")], {
      updatedAt: Date.now() - 60_000,
    });
    const { result } = renderGate(queryClient);

    expect(fetchRange).not.toHaveBeenCalled();
    expect(result.current.read).toBe(true);

    act(() =>
      result.current.cache.writeRange(listKey(range), [
        item("a", "2026-11-15"),
        item("b", "2026-11-16"),
      ])
    );
    expect(result.current.read).toBe(true);
    await waitFor(() => expect(result.current.data["2026-11-16"]?.[0]?.id).toBe("b"));
  });

  it("stays shut on a seed from overlapping ranges, a write into it included", () => {
    fetchRange.mockReset().mockImplementation(pending);
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(listKey({ startISO: "2026-11-01", endISO: "2026-11-30" }), [
      item("a", "2026-11-15"),
    ]);
    const { result } = renderGate(queryClient);

    expect(result.current.data["2026-11-15"]).toHaveLength(1);
    expect(result.current.read).toBe(false);

    act(() => result.current.cache.writeRange(listKey(range), [item("b", "2026-11-16")]));
    expect(result.current.read).toBe(false);
  });

  it("shuts on a new day until that day's range is read", async () => {
    let resolveNextDay: (items: unknown[]) => void = () => {};

    fetchRange
      .mockReset()
      .mockImplementation((input) =>
        input.startISO === range.startISO
          ? Promise.resolve([item("a", "2026-11-16")])
          : new Promise((resolve) => (resolveNextDay = resolve))
      );
    const { result, rerender } = renderGate();

    await waitFor(() => expect(result.current.read).toBe(true));

    rerender({ r: nextDay });
    expect(result.current.data["2026-11-16"]).toHaveLength(1);
    expect(result.current.read).toBe(false);

    await act(async () => resolveNextDay([]));
    expect(result.current.read).toBe(true);
  });

  it("stays shut after a failed first fetch and opens on a later success", async () => {
    fetchRange.mockReset().mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
    const queryClient = createTestQueryClient();
    const { result } = renderGate(queryClient);

    await waitFor(() => expect(queryClient.getQueryState(listKey(range))?.status).toBe("error"));
    expect(result.current.read).toBe(false);

    await act(() => queryClient.refetchQueries({ queryKey: listKey(range) }));
    expect(result.current.read).toBe(true);
  });
});
