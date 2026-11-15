import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useUnsavedNavigationGuard } from "../use-unsaved-navigation-guard";

function guard(hasUnsavedChanges: boolean, agree: boolean) {
  const ask = vi.fn((leave: () => void) => {
    if (agree) leave();
  });
  const { result } = renderHook(() => useUnsavedNavigationGuard({ hasUnsavedChanges, ask }));

  return { ask, result };
}

describe("useUnsavedNavigationGuard", () => {
  it("leaves without asking when nothing changed", () => {
    const { ask, result } = guard(false, false);
    const leave = vi.fn();

    expect(result.current.mustAsk()).toBe(false);
    result.current.requestLeave(leave);

    expect(ask).not.toHaveBeenCalled();
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("asks while there are changes and leaves once the reader agrees", () => {
    const { ask, result } = guard(true, true);
    const leave = vi.fn();

    result.current.requestLeave(leave);

    expect(ask).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledTimes(1);
    // Agreeing lets the navigation it started through.
    expect(result.current.mustAsk()).toBe(false);
  });

  it("stays put when the reader keeps editing", () => {
    const { result } = guard(true, false);
    const leave = vi.fn();

    result.current.requestLeave(leave);

    expect(leave).not.toHaveBeenCalled();
    expect(result.current.mustAsk()).toBe(true);
  });

  it("lets a save's own navigation through, until the save fails", () => {
    const { ask, result } = guard(true, false);

    act(() => result.current.allowNavigation());
    expect(result.current.mustAsk()).toBe(false);
    result.current.requestLeave(vi.fn());
    expect(ask).not.toHaveBeenCalled();

    act(() => result.current.disallowNavigation());
    expect(result.current.mustAsk()).toBe(true);
  });
});
