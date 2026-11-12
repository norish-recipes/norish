// @vitest-environment jsdom
import type { ServerAddressCheck } from "@/lib/network/server-address";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const appState = new Set<(state: string) => void>();
let focused = true;
let settle = (_check: ServerAddressCheck) => {};
const checkServerAddress = vi.fn(
  () =>
    new Promise<ServerAddressCheck>((resolve) => {
      settle = resolve;
    })
);

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_type: string, listener: (state: string) => void) => {
      appState.add(listener);

      return { remove: () => appState.delete(listener) };
    },
  },
}));
vi.mock("expo-router", () => ({ useIsFocused: () => focused }));
vi.mock("@/features/auth/utils/check-server-address", () => ({ checkServerAddress }));

const { useVersionRecheck } = await import("@/features/auth/hooks/use-version-recheck");

const address = "https://norish.example";
const newEnough = { outcome: "ok", address } as const;
const foreground = () => act(() => appState.forEach((listener) => listener("active")));

beforeEach(() => {
  appState.clear();
  focused = true;
  checkServerAddress.mockClear();
});

describe("useVersionRecheck", () => {
  it("re-checks on a return to the foreground and continues once the server is new enough", async () => {
    const onNewEnough = vi.fn();

    renderHook(() => useVersionRecheck(address, onNewEnough));
    foreground();
    await act(async () => settle(newEnough));

    expect(checkServerAddress).toHaveBeenCalledWith(address);
    expect(onNewEnough).toHaveBeenCalledWith(address);
  });

  it("doesn't re-check while Update your server isn't the focused screen", () => {
    focused = false;
    renderHook(() => useVersionRecheck(address, vi.fn()));
    foreground();

    expect(checkServerAddress).not.toHaveBeenCalled();
  });

  it("ignores a result that arrives after focus is lost", async () => {
    const onNewEnough = vi.fn();
    const { rerender } = renderHook(() => useVersionRecheck(address, onNewEnough));

    foreground();
    focused = false;
    rerender();
    await act(async () => settle(newEnough));

    expect(onNewEnough).not.toHaveBeenCalled();
  });

  it("ignores a result that arrives after unmount", async () => {
    const onNewEnough = vi.fn();
    const { unmount } = renderHook(() => useVersionRecheck(address, onNewEnough));

    foreground();
    unmount();
    await act(async () => settle(newEnough));

    expect(onNewEnough).not.toHaveBeenCalled();
  });

  it("never runs two checks at once", async () => {
    renderHook(() => useVersionRecheck(address, vi.fn()));

    foreground();
    foreground();

    expect(checkServerAddress).toHaveBeenCalledOnce();

    await act(async () => settle({ outcome: "too-old", address }));
    foreground();

    expect(checkServerAddress).toHaveBeenCalledTimes(2);
  });
});
