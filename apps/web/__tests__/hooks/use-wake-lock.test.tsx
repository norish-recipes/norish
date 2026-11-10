import { useHoldWakeLock } from "@/hooks/use-wake-lock";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

function sentinel() {
  const listeners: (() => void)[] = [];

  return {
    release: vi.fn(async () => {}),
    addEventListener: vi.fn((_type: string, listener: () => void) => listeners.push(listener)),
    removeEventListener: vi.fn(),
    /** The browser taking the lock back, as it does when the page is hidden. */
    takeBack: () => listeners.forEach((listener) => listener()),
  };
}

function browserGrants() {
  const resolvers: ((value: unknown) => void)[] = [];

  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request: () => new Promise((resolve) => resolvers.push(resolve)) },
  });

  return resolvers;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "wakeLock");
});

describe("useHoldWakeLock", () => {
  it("holds one lock while active and releases it when turned off", async () => {
    const resolvers = browserGrants();
    const lock = sentinel();
    const { rerender } = renderHook(({ active }) => useHoldWakeLock(active, vi.fn()), {
      initialProps: { active: true },
    });

    await act(async () => resolvers[0]?.(lock));
    expect(resolvers).toHaveLength(1);

    rerender({ active: false });

    expect(lock.release).toHaveBeenCalled();
  });

  it("releases a lock granted after it was turned off", async () => {
    const resolvers = browserGrants();
    const late = sentinel();
    const { rerender } = renderHook(({ active }) => useHoldWakeLock(active, vi.fn()), {
      initialProps: { active: true },
    });

    rerender({ active: false });
    await act(async () => resolvers[0]?.(late));

    expect(late.release).toHaveBeenCalled();
  });

  it("turns itself off when the browser takes the lock back", async () => {
    const resolvers = browserGrants();
    const lock = sentinel();
    const setActive = vi.fn();

    renderHook(() => useHoldWakeLock(true, setActive));
    await act(async () => resolvers[0]?.(lock));
    act(() => lock.takeBack());

    expect(setActive).toHaveBeenCalledWith(false);
  });
});
