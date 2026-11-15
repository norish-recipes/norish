// @vitest-environment jsdom
import { SIGN_IN_DEADLINE_MS } from "@/features/auth/utils/auth-failure";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listeners = new Set<(state: string) => void>();
const appState = { currentState: "active" };

vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return appState.currentState;
    },
    addEventListener: (_type: string, listener: (state: string) => void) => {
      listeners.add(listener);

      return { remove: () => listeners.delete(listener) };
    },
  },
}));

const { useSigningIn } = await import("@/features/auth/hooks/use-signing-in");

const change = (state: string) => act(() => listeners.forEach((listener) => listener(state)));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  listeners.clear();
  appState.currentState = "active";
});
afterEach(() => vi.useRealTimers());

describe("useSigningIn", () => {
  it("fails after the deadline in the foreground", () => {
    const { result } = renderHook(() => useSigningIn(false));

    advance(SIGN_IN_DEADLINE_MS - 1);
    expect(result.current).toBe("wait");
    advance(1);
    expect(result.current).toBe("failed");
  });

  it("hands over when a session arrives", () => {
    const { result, rerender } = renderHook(({ s }) => useSigningIn(s), {
      initialProps: { s: false },
    });

    advance(SIGN_IN_DEADLINE_MS - 1);
    rerender({ s: true });
    advance(1);
    expect(result.current).toBe("signed-in");
  });

  it("restarts the wait on a return to the foreground", () => {
    const { result } = renderHook(() => useSigningIn(false));

    advance(SIGN_IN_DEADLINE_MS - 1000);
    change("background");
    // Timers that came due in the background fire on return, so none may be left running.
    advance(60_000);
    expect(result.current).toBe("wait");
    change("active");
    advance(SIGN_IN_DEADLINE_MS - 1);
    expect(result.current).toBe("wait");
    advance(1);
    expect(result.current).toBe("failed");
  });

  it("clears the timer and listener on unmount", () => {
    const { unmount } = renderHook(() => useSigningIn(false));

    unmount();
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
