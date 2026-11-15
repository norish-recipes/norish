// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const listeners = vi.hoisted(() => [] as ((event: { url: string }) => void)[]);

vi.mock("react-native", () => ({
  Linking: {
    addEventListener: (_type: string, listener: (event: { url: string }) => void) => {
      listeners.push(listener);

      return { remove: () => listeners.splice(listeners.indexOf(listener), 1) };
    },
  },
}));
vi.mock("expo-linking", () => ({
  parse: (url: string) => {
    const parsed = new URL(url);

    return {
      path: parsed.pathname.replace(/^\//, ""),
      queryParams: Object.fromEntries(parsed.searchParams),
    };
  },
}));

const { useCalendarLinkArrivals } = await import("../hooks/use-calendar-link-arrivals");

const open = (url: string) => listeners.forEach((listener) => listener({ url }));

describe("useCalendarLinkArrivals", () => {
  it("hands over the day of every Calendar link, the same link twice too", () => {
    const onArrive = vi.fn();
    const { unmount } = renderHook(() => useCalendarLinkArrivals(onArrive));

    open("norish:///calendar?day=2026-11-15");
    open("norish:///calendar?day=2026-11-15");
    open("norish:///recipe/abc");

    expect(onArrive.mock.calls).toEqual([["2026-11-15"], ["2026-11-15"]]);
    unmount();
    expect(listeners).toHaveLength(0);
  });
});
