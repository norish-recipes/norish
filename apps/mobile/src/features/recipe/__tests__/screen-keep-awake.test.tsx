// @vitest-environment jsdom
import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScreenKeepAwake } from "../components/screen-keep-awake";

let wakeLock = "off";
let focused = true;
// The tags expo-keep-awake holds; the screen stays awake while any is held.
const held = new Set<string>();
const activate = vi.fn((tag: string) => {
  held.add(tag);

  return Promise.resolve();
});
const deactivate = vi.fn((tag: string) => {
  held.delete(tag);
});
const Focus = React.createContext<boolean | null>(null);

vi.mock("expo-router", () => ({
  useIsFocused: () => {
    const own = React.useContext(Focus);

    return own ?? focused;
  },
}));
vi.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: (tag: string) => activate(tag),
  deactivateKeepAwake: (tag: string) => deactivate(tag),
}));
vi.mock("@norish/shared-react/recipes", () => ({
  useRecipePageStore: (select: (state: { wakeLock: string }) => unknown) => select({ wakeLock }),
}));

describe("ScreenKeepAwake", () => {
  beforeEach(() => {
    wakeLock = "off";
    focused = true;
    held.clear();
    activate.mockClear();
    deactivate.mockClear();
  });

  it("holds nothing until the reader asks", () => {
    render(<ScreenKeepAwake />);

    expect(activate).not.toHaveBeenCalled();
  });

  it("holds while asked and in front, and lets go on leaving", () => {
    wakeLock = "held";
    const view = render(<ScreenKeepAwake />);

    expect(held.size).toBe(1);

    view.unmount();
    expect(held.size).toBe(0);
  });

  it("lets go when the page goes behind another screen", () => {
    wakeLock = "held";
    const view = render(<ScreenKeepAwake />);

    expect(held.size).toBe(1);

    focused = false;
    view.rerender(<ScreenKeepAwake />);
    expect(held.size).toBe(0);
  });

  it("keeps the hold of the page in front when the one below loses focus later", () => {
    wakeLock = "held";
    const pages = (lower: boolean, upper: boolean) => (
      <>
        <Focus.Provider value={lower}>
          <ScreenKeepAwake />
        </Focus.Provider>
        <Focus.Provider value={upper}>
          <ScreenKeepAwake />
        </Focus.Provider>
      </>
    );
    const view = render(pages(false, true));

    view.rerender(pages(true, true));
    view.rerender(pages(false, true));
    expect(held.size).toBe(1);
  });

  it("does not hold behind another screen", () => {
    wakeLock = "held";
    focused = false;
    render(<ScreenKeepAwake />);

    expect(activate).not.toHaveBeenCalled();
  });
});
