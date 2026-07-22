import { useIsMobile } from "@/hooks/use-is-mobile";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
}

describe("useIsMobile", () => {
  it("reports mobile below the md breakpoint", () => {
    setViewportWidth(500);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it("reports desktop at the breakpoint and follows resizes", () => {
    setViewportWidth(768);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    act(() => {
      setViewportWidth(600);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(true);

    act(() => {
      setViewportWidth(1280);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(false);
  });
});
