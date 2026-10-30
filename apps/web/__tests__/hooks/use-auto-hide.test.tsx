import { startTransition } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { useAutoHide } from "@/hooks/auto-hide";

const PAGE_HEIGHT = 3000;
const VIEWPORT_HEIGHT = 800;
/** The largest scrollTop that is not yet the foot of the page. */
const MID_PAGE = 1000;
const PAGE_BOTTOM = PAGE_HEIGHT - VIEWPORT_HEIGHT;

const mocks = vi.hoisted(() => {
  const state = {
    onScroll: null as null | ((latest: number) => void),
    scrollY: 0,
    pathname: "/groceries",
  };

  return {
    state,
    // One motion value for the life of the test: the hook keys its
    // route-change reset on this identity, so a fresh object per render would
    // re-show the chrome on every render and hide the behaviour under test.
    scroll: { scrollY: { get: () => state.scrollY } },
  };
});

vi.mock("motion/react", () => ({
  useScroll: () => mocks.scroll,
  useMotionValueEvent: (_value: unknown, _event: string, callback: (latest: number) => void) => {
    mocks.state.onScroll = callback;
  },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.state.pathname,
}));

function setViewport(height: number, pageHeight: number) {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: pageHeight,
  });
}

/** Scroll as the browser would: the position the hook reads and the event. */
function scrollTo(top: number) {
  act(() => {
    mocks.state.scrollY = top;
    Object.defineProperty(window, "scrollY", { configurable: true, value: top });
    mocks.state.onScroll?.(top);
  });
}

/** Past the settling window the hook ignores after a route change. */
function settle() {
  act(() => {
    // The window is measured with `Date.now()`, so the clock has to move too,
    // not just the timer queue.
    vi.setSystemTime(Date.now() + 1100);
    vi.advanceTimersByTime(1100);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.state.scrollY = 0;
  mocks.state.pathname = "/groceries";
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  setViewport(VIEWPORT_HEIGHT, PAGE_HEIGHT);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * The nav shrinks out of the way while a reader is reading, and everything
 * floating above it shrinks with it. The foot of the page is the exception:
 * the last screen already reserves room for the bar and the dock row, so
 * shrinking there gives up controls to buy space that is spare anyway.
 */
describe("useAutoHide", () => {
  it("gets out of the way on the way down the page", () => {
    const { result } = renderHook(() => useAutoHide());

    settle();
    scrollTo(MID_PAGE);

    expect(result.current.isVisible).toBe(false);
  });

  it("comes back at the foot of the page", () => {
    const { result } = renderHook(() => useAutoHide());

    settle();
    scrollTo(MID_PAGE);
    expect(result.current.isVisible).toBe(false);

    scrollTo(PAGE_BOTTOM);

    expect(result.current.isVisible).toBe(true);
  });

  it("stays there once the reader stops scrolling", () => {
    const { result } = renderHook(() => useAutoHide({ idleDelay: 4000 }));

    settle();
    scrollTo(MID_PAGE);
    scrollTo(PAGE_BOTTOM);

    // Well past the idle delay that would have hidden it mid-page.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.isVisible).toBe(true);
  });

  it("treats a few pixels short of the end as the end", () => {
    const { result } = renderHook(() => useAutoHide());

    settle();
    scrollTo(MID_PAGE);
    scrollTo(PAGE_BOTTOM - 4);

    expect(result.current.isVisible).toBe(true);
  });

  it("does not pin itself open once the reader leaves the foot again", () => {
    const { result } = renderHook(() => useAutoHide());

    settle();
    scrollTo(PAGE_BOTTOM);
    expect(result.current.isVisible).toBe(true);

    // Back up the page — scrolling up always reveals the chrome — and then
    // down again, which is an ordinary mid-page read.
    scrollTo(500);
    scrollTo(MID_PAGE + 500);

    expect(result.current.isVisible).toBe(false);
  });

  it("comes back when the page shrinks under a reader onto its own foot", () => {
    const { result } = renderHook(() => useAutoHide());

    settle();
    scrollTo(MID_PAGE);
    expect(result.current.isVisible).toBe(false);

    // Rows deleted out from under them: same scroll position, shorter page,
    // and no scroll event to notice it by.
    act(() => {
      setViewport(VIEWPORT_HEIGHT, MID_PAGE + VIEWPORT_HEIGHT);
      vi.advanceTimersByTime(1100);
    });

    expect(result.current.isVisible).toBe(true);
  });

  it("stays shown after the pointer leaves a nav that only hides on scroll", () => {
    const { result } = renderHook(() => useAutoHide({ idleDelay: Infinity }));

    settle();
    scrollTo(MID_PAGE);
    act(() => result.current.onHoverStart());
    expect(result.current.isVisible).toBe(true);

    // A page transition takes the hover away too; browsers run an Infinity timeout at once.
    act(() => result.current.onHoverEnd());
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.isVisible).toBe(true);
  });

  it("shows on a new page however often the last one asked it to hide", () => {
    const { result, rerender } = renderHook(() => useAutoHide());

    settle();
    // Every scrolled frame asks to hide, long after it already has.
    scrollTo(MID_PAGE);
    scrollTo(MID_PAGE + 100);
    scrollTo(MID_PAGE + 200);
    expect(result.current.isVisible).toBe(false);

    // A navigation renders as a transition; the next ordinary render must not
    // replay the old page's requests over the new page's reset.
    mocks.state.pathname = "/calendar";
    act(() => startTransition(() => rerender()));
    act(() => rerender());

    expect(result.current.isVisible).toBe(true);
  });
});
