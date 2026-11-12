// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let signOut = vi.fn<(onLeaving?: () => void) => Promise<boolean>>();
const push = vi.fn();

vi.mock("@/hooks/use-confirmed-sign-out", () => ({ useConfirmedSignOut: () => signOut }));
vi.mock("expo-router", () => ({ router: { push } }));

const { changeServerAddress, takeServerChangeAfterSignOut, useSignOutBeforeServerChange } =
  await import("@/hooks/use-change-server-address");

// The chip while signed in; resolves whether the signed-out stack's first screen opens Server address.
async function chipThenSignedOut(result: Promise<boolean>) {
  // As useConfirmedSignOut: `onLeaving` runs only once the Sign-out goes ahead.
  signOut = vi.fn(async (onLeaving) => {
    const left = await result;

    if (left) onLeaving?.();

    return left;
  });
  const shell = renderHook(() => useSignOutBeforeServerChange());

  changeServerAddress();
  await act(async () => {
    await result.catch(() => {});
  });
  shell.unmount();

  return takeServerChangeAfterSignOut();
}

beforeEach(() => {
  push.mockClear();
  takeServerChangeAfterSignOut();
});

describe("changeServerAddress while signed in", () => {
  it("opens Server address once the Sign-out completes", async () => {
    expect(await chipThenSignedOut(Promise.resolve(true))).toBe(true);
    expect(takeServerChangeAfterSignOut()).toBe(false);
  });

  it("drops the change when the Sign-out is cancelled", async () => {
    expect(await chipThenSignedOut(Promise.resolve(false))).toBe(false);
  });

  it("holds no pending change while the unsynced-work confirm is up", async () => {
    signOut = vi.fn(() => new Promise<boolean>(() => {}));
    const shell = renderHook(() => useSignOutBeforeServerChange());

    changeServerAddress();
    // A Session Expiry lands on the signed-out entry while the confirm is still up.
    shell.unmount();

    expect(takeServerChangeAfterSignOut()).toBe(false);
  });

  it("drops the change when the unsynced-changes read rejects", async () => {
    expect(await chipThenSignedOut(Promise.reject(new Error("outbox unreadable")))).toBe(false);
  });
});
