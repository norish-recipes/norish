// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let signOut = vi.fn<() => Promise<boolean>>();
const push = vi.fn();
const replace = vi.fn();

vi.mock("@/hooks/use-confirmed-sign-out", () => ({ useConfirmedSignOut: () => signOut }));
vi.mock("expo-router", () => ({ router: { push, replace } }));

const { changeServerAddress, useServerChangeAfterSignOut, useSignOutBeforeServerChange } =
  await import("@/hooks/use-change-server-address");

// The chip while signed in, then the signed-out stack mounting after a later Sign-out.
async function chipThenSignedOut(result: Promise<boolean>) {
  signOut = vi.fn(() => result);
  const shell = renderHook(() => useSignOutBeforeServerChange());

  changeServerAddress();
  await act(async () => {
    await result.catch(() => {});
  });
  shell.unmount();
  renderHook(() => useServerChangeAfterSignOut(true));
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
});

describe("changeServerAddress while signed in", () => {
  it("opens Server address once the Sign-out completes", async () => {
    await chipThenSignedOut(Promise.resolve(true));

    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("drops the change when the Sign-out is cancelled", async () => {
    await chipThenSignedOut(Promise.resolve(false));

    expect(replace).not.toHaveBeenCalled();
  });

  it("drops the change when the unsynced-changes read rejects", async () => {
    await chipThenSignedOut(Promise.reject(new Error("outbox unreadable")));

    expect(replace).not.toHaveBeenCalled();
  });
});
