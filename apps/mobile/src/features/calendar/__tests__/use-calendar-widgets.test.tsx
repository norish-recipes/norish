// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.fn(async () => {});
const clear = vi.fn(async (_message: string) => {});
const range = vi.hoisted(() => ({ read: false, household: "h1" }));

vi.mock("expo-linking", () => ({ createURL: (path: string) => path }));
vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: () => "", formatDate: () => "" }),
}));
vi.mock("@/lib/calendar-widgets", () => ({
  startCalendarWidgets: () => {},
  syncCalendarWidgets: sync,
  clearCalendarWidgets: clear,
}));
// Seeded from another range's cache, so the query already reads as `isRead`.
vi.mock("@norish/shared-react/calendar", () => ({
  useCalendarQuery: () => ({ calendarData: {}, isLoading: false, isRead: true }),
  useCalendarRangeRead: () => range.read,
}));
vi.mock("@norish/shared-react/reader", () => ({
  useToday: () => "2026-11-15",
  useHousehold: () => ({ household: { id: range.household } }),
}));

const { useCalendarWidgets } = await import("../hooks/use-calendar-widgets");

beforeEach(() => {
  sync.mockClear();
  clear.mockClear();
  range.household = "h1";
});

describe("useCalendarWidgets", () => {
  it("pushes nothing until the widgets' own range is read, then pushes", () => {
    range.read = false;
    const { rerender } = renderHook(() => useCalendarWidgets());

    expect(sync).not.toHaveBeenCalled();
    range.read = true;
    rerender();

    expect(sync).toHaveBeenCalledOnce();
  });

  it("empties the widgets when the household changes, though the new plan is not read yet", () => {
    range.read = true;
    const { rerender } = renderHook(() => useCalendarWidgets());

    expect(clear).not.toHaveBeenCalled();
    range.read = false;
    range.household = "h2";
    rerender();

    expect(clear).toHaveBeenCalledOnce();
  });
});
