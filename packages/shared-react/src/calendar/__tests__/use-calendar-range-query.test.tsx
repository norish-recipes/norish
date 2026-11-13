import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { CalendarRangeProvider, useCalendarRange } from "../calendar-range-store";
import { useCalendarRangeQuery } from "../use-calendar-range-query";

const readRange = vi.fn<(input: { startISO: string; endISO: string }) => Promise<unknown[]>>();

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    calendar: {
      listItems: {
        queryKey: () => ["calendar", "listItems"],
        queryOptions: (input: { startISO: string; endISO: string }) => ({
          queryKey: ["calendar", "listItems", { input }],
          queryFn: () => readRange(input),
        }),
      },
    },
  }),
}));

function renderCalendar() {
  const Providers = createTestWrapper(createTestQueryClient());

  return renderHook(
    () => ({ ...useCalendarRangeQuery(), grow: useCalendarRange((state) => state.grow) }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <Providers>
          <CalendarRangeProvider today="2026-11-11">{children}</CalendarRangeProvider>
        </Providers>
      ),
    }
  );
}

describe("useCalendarRangeQuery", () => {
  it("is loading only until the first read settles, even when it fails", async () => {
    readRange.mockRejectedValueOnce(new Error("offline"));
    readRange.mockReturnValue(new Promise(() => {}));

    const { result } = renderCalendar();

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.grow("future"));

    expect(result.current.range.endISO).toBe("2026-12-11");
    expect(result.current.isLoading).toBe(false);
  });
});
