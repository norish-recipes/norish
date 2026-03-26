import { usePrependAnchorRestore } from "@/components/calendar/use-prepend-anchor-restore";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("usePrependAnchorRestore", () => {
  it("is a no-op when restore is called without a pending anchor", () => {
    const { result } = renderHook(() => usePrependAnchorRestore({ keys: ["2026-01-01"] }));

    const getVirtualItems = vi.fn(() => [{ index: 0, start: 100 }]);
    const scrollToOffset = vi.fn();

    act(() => {
      result.current.restoreAnchor(getVirtualItems, scrollToOffset);
    });

    expect(getVirtualItems).not.toHaveBeenCalled();
    expect(scrollToOffset).not.toHaveBeenCalled();
  });

  it("applies normal size-change adjustment when no prepend anchor is pending", () => {
    const { result } = renderHook(() => usePrependAnchorRestore({ keys: ["2026-01-01"] }));

    expect(result.current.shouldAdjustScrollForSizeChange(100, 150, 0)).toBe(true);
    expect(result.current.shouldAdjustScrollForSizeChange(200, 150, 0)).toBe(false);
  });

  it("disables size-change adjustment while prepend anchor is pending", () => {
    const { result } = renderHook(() => usePrependAnchorRestore({ keys: ["2026-01-01"] }));

    act(() => {
      result.current.captureAnchor({
        index: 0,
        itemStart: 100,
        scrollOffset: 140,
      });
    });

    expect(result.current.shouldAdjustScrollForSizeChange(50, 200, 0)).toBe(false);
  });

  it("restores scroll offset from captured anchor and clears pending state", () => {
    const { result } = renderHook(() =>
      usePrependAnchorRestore({
        keys: ["2026-01-01", "2026-01-02", "2026-01-03"],
      })
    );

    const scrollToOffset = vi.fn();

    act(() => {
      result.current.captureAnchor({
        index: 1,
        itemStart: 300,
        scrollOffset: 330,
      });
    });

    act(() => {
      result.current.restoreAnchor(
        () => [
          { index: 0, start: 100 },
          { index: 1, start: 500 },
        ],
        scrollToOffset
      );
    });

    expect(scrollToOffset).toHaveBeenCalledWith(530);

    // Pending state should be cleared after restore.
    expect(result.current.shouldAdjustScrollForSizeChange(50, 200, 0)).toBe(true);
  });

  it("clears pending state when target item is not found", () => {
    const { result } = renderHook(() =>
      usePrependAnchorRestore({
        keys: ["2026-01-01", "2026-01-02"],
      })
    );

    const scrollToOffset = vi.fn();

    act(() => {
      result.current.captureAnchor({
        index: 1,
        itemStart: 300,
        scrollOffset: 330,
      });
    });

    act(() => {
      result.current.restoreAnchor(() => [{ index: 0, start: 100 }], scrollToOffset);
    });

    expect(scrollToOffset).not.toHaveBeenCalled();
    expect(result.current.shouldAdjustScrollForSizeChange(50, 200, 0)).toBe(true);
  });

  it("clears pending state when captured key is no longer in keys", () => {
    const { result, rerender } = renderHook(({ keys }) => usePrependAnchorRestore({ keys }), {
      initialProps: { keys: ["2026-01-01", "2026-01-02"] },
    });

    const scrollToOffset = vi.fn();

    act(() => {
      result.current.captureAnchor({
        index: 1,
        itemStart: 300,
        scrollOffset: 330,
      });
    });

    rerender({ keys: ["2026-01-03", "2026-01-04"] });

    act(() => {
      result.current.restoreAnchor(() => [{ index: 0, start: 100 }], scrollToOffset);
    });

    expect(scrollToOffset).not.toHaveBeenCalled();
    expect(result.current.shouldAdjustScrollForSizeChange(50, 200, 0)).toBe(true);
  });
});
