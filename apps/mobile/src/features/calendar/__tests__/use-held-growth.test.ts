// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useHeldGrowth } from "../hooks/use-held-growth";

describe("useHeldGrowth", () => {
  it("grows at a reached edge at once, or once a held row is let go", () => {
    const grow = vi.fn();
    const { result } = renderHook(() => useHeldGrowth(grow));

    result.current.reached("future");
    expect(grow).toHaveBeenLastCalledWith("future");

    result.current.heldChange(true);
    result.current.reached("past");
    result.current.reached("past");
    expect(grow).toHaveBeenCalledTimes(1);

    // The list tells an edge once per content length: a drop that left it unchanged tells none.
    result.current.heldChange(false);
    expect(grow).toHaveBeenCalledTimes(2);
    expect(grow).toHaveBeenLastCalledWith("past");

    result.current.heldChange(true);
    result.current.heldChange(false);
    expect(grow).toHaveBeenCalledTimes(2);
  });
});
