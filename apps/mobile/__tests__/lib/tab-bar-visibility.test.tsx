// @vitest-environment jsdom
import { useHideTabBar, useTabBarHidden } from "@/lib/tab-bar-visibility";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let focused = true;
let routes = ["recipe"];
let tabFocused = true;
const subscribers = new Set<() => void>();
const changed = () => subscribers.forEach((notify) => notify());
const subscribe = (_event: string, notify: () => void) => {
  subscribers.add(notify);

  return () => void subscribers.delete(notify);
};
// The Recipes stack's navigation for the recipe's screen, and the tab navigator's above it.
const navigation = {
  addListener: subscribe,
  getState: () => ({ routes: routes.map((name) => ({ key: name, name })) }),
  getParent: () => ({ addListener: subscribe, isFocused: () => tabFocused }),
};

vi.mock("expo-router", () => ({
  useIsFocused: () => focused,
  useNavigation: () => navigation,
  useRoute: () => ({ key: "recipe", name: "recipe" }),
}));

describe("useHideTabBar", () => {
  it("hides the bar only while the screen is in front", () => {
    focused = true;
    routes = ["recipe"];
    tabFocused = true;
    const hidden = renderHook(() => useTabBarHidden());
    const screen = renderHook(() => useHideTabBar());

    expect(hidden.result.current).toBe(true);

    focused = false;
    screen.rerender({});
    expect(hidden.result.current).toBe(false);

    focused = true;
    screen.rerender({});
    expect(hidden.result.current).toBe(true);

    screen.unmount();
    expect(hidden.result.current).toBe(false);
  });

  it("stays hidden under a sheet over the screen, and returns when another tab is in front", () => {
    focused = true;
    routes = ["recipe"];
    tabFocused = true;
    const hidden = renderHook(() => useTabBarHidden());

    const screen = renderHook(() => useHideTabBar(["add-to-groceries"]));
    expect(hidden.result.current).toBe(true);

    // A sheet opens over the recipe: the recipe loses focus but the bar stays away.
    focused = false;
    routes = ["recipe", "add-to-groceries"];
    act(changed);
    screen.rerender();
    expect(hidden.result.current).toBe(true);

    // Another tab comes to the front with the sheet still open.
    tabFocused = false;
    act(changed);
    screen.rerender();
    expect(hidden.result.current).toBe(false);
  });

  it("shows the bar over a screen that is not one of its sheets", () => {
    focused = false;
    routes = ["recipe", "cookbook"];
    tabFocused = true;
    const hidden = renderHook(() => useTabBarHidden());

    renderHook(() => useHideTabBar(["add-to-groceries"]));
    expect(hidden.result.current).toBe(false);
  });
});
