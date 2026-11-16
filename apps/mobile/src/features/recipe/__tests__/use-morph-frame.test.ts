// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useMorphFrame, GROW_MS, HIDE_MS, SETTLE_MS } = await import("../hooks/use-morph-frame");

describe("useMorphFrame", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("grows the frame once the pill's content is hidden, and draws the list after", () => {
    const { result, rerender } = renderHook(({ open }) => useMorphFrame(open), {
      initialProps: { open: false },
    });

    expect(result.current).toEqual({ large: false, drawn: false });

    rerender({ open: true });
    expect(result.current).toEqual({ large: false, drawn: false });

    act(() => vi.advanceTimersByTime(HIDE_MS));
    expect(result.current).toEqual({ large: true, drawn: false });

    act(() => vi.advanceTimersByTime(GROW_MS));
    expect(result.current).toEqual({ large: true, drawn: true });
  });

  it("keeps the frame large until the list has shrunk back into the pill", () => {
    const { result, rerender } = renderHook(({ open }) => useMorphFrame(open), {
      initialProps: { open: true },
    });

    expect(result.current).toEqual({ large: true, drawn: true });

    rerender({ open: false });
    expect(result.current).toEqual({ large: true, drawn: false });

    act(() => vi.advanceTimersByTime(SETTLE_MS - 1));
    expect(result.current.large).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toEqual({ large: false, drawn: false });
  });

  it("reopened while it settles, stays large and draws the list again", () => {
    const { result, rerender } = renderHook(({ open }) => useMorphFrame(open), {
      initialProps: { open: true },
    });

    rerender({ open: false });
    act(() => vi.advanceTimersByTime(100));
    rerender({ open: true });
    expect(result.current.large).toBe(true);
    act(() => vi.advanceTimersByTime(SETTLE_MS));

    expect(result.current).toEqual({ large: true, drawn: true });
  });
});
