// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScreenKeepAwake } from "../components/screen-keep-awake";

let wakeLock = "off";
let focused = true;
const activate = vi.fn(() => Promise.resolve());
const deactivate = vi.fn();

vi.mock("expo-router", () => ({ useIsFocused: () => focused }));
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

    expect(activate).toHaveBeenCalledWith("recipe-page");

    view.unmount();
    expect(deactivate).toHaveBeenCalledWith("recipe-page");
  });

  it("does not hold behind another screen", () => {
    wakeLock = "held";
    focused = false;
    render(<ScreenKeepAwake />);

    expect(activate).not.toHaveBeenCalled();
  });
});
