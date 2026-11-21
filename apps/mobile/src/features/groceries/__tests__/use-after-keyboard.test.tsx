// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAfterKeyboard } from "../hooks/use-after-keyboard";

const keyboard = vi.hoisted(() => ({
  visible: false,
  hidden: new Set<() => void>(),
  dismiss: vi.fn(),
}));

vi.mock("react-native", () => ({
  Keyboard: {
    isVisible: () => keyboard.visible,
    dismiss: keyboard.dismiss,
    addListener: (_: string, listener: () => void) => {
      keyboard.hidden.add(listener);

      return { remove: () => keyboard.hidden.delete(listener) };
    },
  },
}));

const hide = () => {
  keyboard.visible = false;
  keyboard.hidden.forEach((listener) => listener());
};

describe("useAfterKeyboard", () => {
  it("changes the step at once while no keyboard is up", () => {
    keyboard.visible = false;
    const run = vi.fn();
    const { result } = renderHook(() => useAfterKeyboard());

    result.current(run);
    expect(run).toHaveBeenCalledOnce();
  });

  it("dismisses the keyboard and changes the step once it is down", () => {
    keyboard.visible = true;
    const run = vi.fn();
    const { result } = renderHook(() => useAfterKeyboard());

    result.current(run);
    expect(keyboard.dismiss).toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();

    hide();
    expect(run).toHaveBeenCalledOnce();
    expect(keyboard.hidden.size).toBe(0);
  });

  it("drops a waiting step when the sheet closes first", () => {
    keyboard.visible = true;
    const run = vi.fn();
    const { result, unmount } = renderHook(() => useAfterKeyboard());

    result.current(run);
    unmount();
    hide();
    expect(run).not.toHaveBeenCalled();
  });
});
