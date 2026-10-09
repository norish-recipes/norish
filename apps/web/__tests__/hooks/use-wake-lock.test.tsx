import { useWakeLock } from "@/hooks/use-wake-lock";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

function sentinel() {
  return {
    release: vi.fn(async () => {}),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "wakeLock");
});

describe("useWakeLock", () => {
  it("keeps one lock when a second tap lands while the first request is on its way", async () => {
    const first = sentinel();
    const second = sentinel();
    const resolvers: ((value: unknown) => void)[] = [];

    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request: () => new Promise((resolve) => resolvers.push(resolve)) },
    });

    const { result } = renderHook(() => useWakeLock());

    let pending: Promise<unknown> = Promise.resolve();

    act(() => {
      pending = Promise.all([result.current.enable(), result.current.enable()]);
    });
    await act(async () => {
      resolvers[0]?.(first);
      resolvers[1]?.(second);
      await pending;
    });

    expect(second.release).toHaveBeenCalled();
    expect(result.current.isActive).toBe(true);

    act(() => result.current.disable());

    expect(first.release).toHaveBeenCalled();
  });
});
