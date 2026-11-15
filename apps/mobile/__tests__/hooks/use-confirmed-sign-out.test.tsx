// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type AlertButton = { onPress?: () => void };

let buttons: AlertButton[] = [];
const signOut = vi.fn(async () => {});

vi.mock("react-native", () => ({
  Alert: { alert: (_title: string, _message: string, shown: AlertButton[]) => (buttons = shown) },
}));
vi.mock("react-intl", () => ({ useIntl: () => ({ formatMessage: () => "" }) }));
vi.mock("@/lib/offline/engine", () => ({ offlineEngine: { unsyncedChanges: async () => 2 } }));
vi.mock("@norish/shared-react/reader", () => ({ useSignOut: () => signOut }));

const { useConfirmedSignOut } = await import("@/hooks/use-confirmed-sign-out");
const { publishSignedIn, publishSignedOut } = await import("@/lib/auth/auth-session-sync");

beforeEach(() => {
  buttons = [];
  signOut.mockClear();
  publishSignedIn("reader-1");
});

describe("useConfirmedSignOut", () => {
  it("signs out from the unsynced-work confirm, after announcing it", async () => {
    const onLeaving = vi.fn();
    const { result } = renderHook(() => useConfirmedSignOut());
    let left = Promise.resolve(true);

    await act(async () => void (left = result.current(onLeaving)));
    act(() => buttons[1]?.onPress?.());

    expect(onLeaving).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledWith({ discardQueue: true });
    await act(async () => void (await left));
  });

  it("does nothing from the confirm once the session it was shown for has ended", async () => {
    const onLeaving = vi.fn();
    const { result } = renderHook(() => useConfirmedSignOut());
    let left = Promise.resolve(true);

    await act(async () => void (left = result.current(onLeaving)));
    // A Session Expiry while the confirm is up.
    act(() => publishSignedOut("https://norish.test"));
    act(() => buttons[1]?.onPress?.());

    expect(await left).toBe(false);
    expect(onLeaving).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
