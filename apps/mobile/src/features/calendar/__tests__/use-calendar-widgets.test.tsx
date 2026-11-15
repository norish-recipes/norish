// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.fn(async () => {});
const range = vi.hoisted(() => ({ fetched: false }));

vi.mock("expo-linking", () => ({ createURL: (path: string) => path }));
vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: () => "", formatDate: () => "" }),
}));
vi.mock("@/lib/calendar-widgets", () => ({
  startCalendarWidgets: () => {},
  syncCalendarWidgets: sync,
}));
// Seeded from another range's cache, so the query already reads as `isRead`.
vi.mock("@norish/shared-react/calendar", () => ({
  useCalendarQuery: () => ({ calendarData: {}, isLoading: false, isRead: true }),
  useCalendarRangeFetched: () => range.fetched,
}));
vi.mock("@norish/shared-react/reader", () => ({ useToday: () => "2026-11-15" }));

const { useCalendarWidgets } = await import("../hooks/use-calendar-widgets");

beforeEach(() => sync.mockClear());

describe("useCalendarWidgets", () => {
  it("pushes nothing until the widgets' own range is fetched, then pushes", () => {
    range.fetched = false;
    const { rerender } = renderHook(() => useCalendarWidgets());

    expect(sync).not.toHaveBeenCalled();
    range.fetched = true;
    rerender();

    expect(sync).toHaveBeenCalledOnce();
  });
});
