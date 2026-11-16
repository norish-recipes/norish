// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Listener = (event: { data: { closing: boolean } }) => void;

// Each screen is a navigation of its own: `screen.key` picks which one the next hook mounts in.
const screen = vi.hoisted(() => ({ key: "", listeners: new Map<string, Map<string, Listener>>() }));

vi.mock("expo-router", () => ({
  useRoute: () => ({ key: screen.key }),
  useNavigation: () => {
    const own = screen.listeners.get(screen.key) ?? new Map<string, Listener>();

    screen.listeners.set(screen.key, own);

    return {
      addListener: (name: string, listener: Listener) => {
        own.set(name, listener);

        return () => own.delete(name);
      },
    };
  },
}));

const { useMarkRecipeShown, useShownRecipe } = await import("@/lib/shown-recipe");

const mount = (key: string, id: string) => {
  screen.key = key;

  return renderHook(() => useMarkRecipeShown(id));
};
const transition = (key: string, closing: boolean) =>
  act(() => screen.listeners.get(key)?.get("transitionStart")?.({ data: { closing } }));

describe("the shown recipe", () => {
  it("stays the lower page's when the same recipe pushed above it goes", () => {
    const shown = renderHook(() => useShownRecipe());
    mount("lower", "a");
    transition("lower", false);
    // A → its cookbook → A again.
    transition("lower", true);
    const upper = mount("upper", "a");
    transition("upper", false);

    // Pop the upper A, then the cookbook back to the lower A before the upper one unmounts.
    transition("upper", true);
    transition("lower", false);
    upper.unmount();

    expect(shown.result.current).toBe("a");
  });

  it("clears when the page closes", () => {
    const shown = renderHook(() => useShownRecipe());
    const page = mount("only", "b");
    transition("only", false);

    expect(shown.result.current).toBe("b");

    transition("only", true);
    expect(shown.result.current).toBeNull();
    page.unmount();
  });
});
