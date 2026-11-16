// @vitest-environment jsdom
import {
  useHideTabBar,
  useMarkSheetOpen,
  useSheetOpen,
  useTabBarHidden,
} from "@/lib/tab-bar-visibility";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let focused = true;

vi.mock("expo-router", () => ({ useIsFocused: () => focused }));

describe("tab bar visibility", () => {
  it("hides the bar only while the screen is in front", () => {
    focused = true;
    const hidden = renderHook(() => useTabBarHidden());
    const screen = renderHook(() => useHideTabBar());

    expect(hidden.result.current).toBe(true);

    focused = false;
    screen.rerender();
    expect(hidden.result.current).toBe(false);

    focused = true;
    screen.rerender();
    expect(hidden.result.current).toBe(true);

    screen.unmount();
    expect(hidden.result.current).toBe(false);
  });

  it("hides the bar and flags the page for as long as a sheet is mounted", () => {
    const hidden = renderHook(() => useTabBarHidden());
    const open = renderHook(() => useSheetOpen());

    expect(hidden.result.current).toBe(false);
    expect(open.result.current).toBe(false);

    const sheet = renderHook(() => useMarkSheetOpen());

    expect(hidden.result.current).toBe(true);
    expect(open.result.current).toBe(true);

    sheet.unmount();
    expect(hidden.result.current).toBe(false);
    expect(open.result.current).toBe(false);
  });

  it("keeps a page that hides the bar from counting as a sheet over it", () => {
    focused = true;
    const open = renderHook(() => useSheetOpen());

    renderHook(() => useHideTabBar());
    expect(open.result.current).toBe(false);
  });
});
