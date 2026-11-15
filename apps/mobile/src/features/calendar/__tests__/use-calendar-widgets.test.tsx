// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.fn(async () => {});
const listKey = (input: object) => [["calendar", "listItems"], { input, type: "query" }];

vi.mock("expo-linking", () => ({ createURL: (path: string) => path }));
vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: () => "", formatDate: () => "" }),
}));
vi.mock("@/lib/calendar-widgets", () => ({
  startCalendarWidgets: () => {},
  syncCalendarWidgets: sync,
}));
vi.mock("@norish/shared-react/trpc", () => ({
  useTRPC: () => ({ calendar: { listItems: { queryKey: listKey } } }),
}));
// Seeded from another range's cache, so it already reads as `isRead`.
vi.mock("@norish/shared-react/calendar", () => ({
  useCalendarQuery: () => ({ calendarData: {}, isLoading: false, isRead: true }),
}));
vi.mock("@norish/shared-react/reader", () => ({ useToday: () => "2026-11-15" }));

const { useCalendarWidgets } = await import("../hooks/use-calendar-widgets");

const range = { startISO: "2026-11-15", endISO: "2026-12-04" };
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  client = new QueryClient();
  sync.mockClear();
});

describe("useCalendarWidgets", () => {
  it("pushes nothing until the widgets' own range is read", async () => {
    renderHook(() => useCalendarWidgets(), { wrapper });
    // A seed and a realtime write into it are not a read of the range.
    act(() => void client.setQueryData(listKey(range), []));
    expect(sync).not.toHaveBeenCalled();

    await act(() => client.fetchQuery({ queryKey: listKey(range), queryFn: async () => [] }));

    expect(sync).toHaveBeenCalled();
  });

  it("ignores a read of another range", async () => {
    renderHook(() => useCalendarWidgets(), { wrapper });

    await act(() =>
      client.fetchQuery({
        queryKey: listKey({ startISO: "2026-11-01", endISO: "2026-11-30" }),
        queryFn: async () => [],
      })
    );

    expect(sync).not.toHaveBeenCalled();
  });
});
