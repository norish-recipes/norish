// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let signOut = vi.fn<() => Promise<boolean>>();
const push = vi.fn();

vi.mock("@/hooks/use-confirmed-sign-out", () => ({ useConfirmedSignOut: () => signOut }));
vi.mock("expo-router", () => ({ router: { push } }));

const { changeServerAddress, takeServerChangeAfterSignOut, useSignOutBeforeServerChange } =
  await import("@/hooks/use-change-server-address");

// The chip while signed in; resolves whether the signed-out stack's first screen opens Server address.
async function chipThenSignedOut(result: Promise<boolean>) {
  signOut = vi.fn(() => result);
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

  it("drops the change when the unsynced-changes read rejects", async () => {
    expect(await chipThenSignedOut(Promise.reject(new Error("outbox unreadable")))).toBe(false);
  });
});
