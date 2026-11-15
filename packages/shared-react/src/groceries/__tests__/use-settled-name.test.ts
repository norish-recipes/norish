import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSettledName } from "../use-settled-name";

describe("useSettledName", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("holds the last settled name until typing has stopped", () => {
    const { result, rerender } = renderHook(({ name }) => useSettledName(name), {
      initialProps: { name: "mel" },
    });

    rerender({ name: "melk" });
    expect(result.current).toBe("mel");
    act(() => vi.advanceTimersByTime(400));
    expect(result.current).toBe("melk");
  });

  it("settles an emptied field at once", () => {
    const { result, rerender } = renderHook(({ name }) => useSettledName(name), {
      initialProps: { name: "melk" },
    });

    rerender({ name: "" });
    expect(result.current).toBe("");
  });
});
