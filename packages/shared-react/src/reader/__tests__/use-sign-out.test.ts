import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SignOutOptions } from "@norish/shared-react/reader";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";
import { useSignOut } from "@norish/shared-react/reader";

describe("useSignOut", () => {
  let adapter: ReturnType<typeof fakePlatformAdapter>;
  let steps: string[];

  const signOut = (options?: SignOutOptions) =>
    renderHook(() => useSignOut(), {
      wrapper: createTestWrapper(createTestQueryClient(), adapter),
    }).result.current(options);

  beforeEach(() => {
    steps = [];
    adapter = fakePlatformAdapter();
    vi.mocked(adapter.endSession).mockImplementation(async () => void steps.push("end"));
    vi.mocked(adapter.offlineEngine.clearForSignOut).mockImplementation(
      async () => void steps.push("clear")
    );
    vi.mocked(adapter.leave).mockImplementation(() => void steps.push("leave"));
  });

  it("ends the session, then clears the Offline Cache keeping the queue, then leaves", async () => {
    await signOut();

    expect(steps).toEqual(["end", "clear", "leave"]);
    expect(adapter.offlineEngine.clearForSignOut).toHaveBeenCalledWith({ discardQueue: false });
  });

  it("discards the queue once the reader agreed to", async () => {
    await signOut({ discardQueue: true });

    expect(adapter.offlineEngine.clearForSignOut).toHaveBeenCalledWith({ discardQueue: true });
  });

  it("clears nothing and says why when the session could not be ended", async () => {
    vi.mocked(adapter.endSession).mockRejectedValue(new Error("offline"));

    await signOut({ discardQueue: true });

    expect(adapter.offlineEngine.clearForSignOut).not.toHaveBeenCalled();
    expect(adapter.leave).not.toHaveBeenCalled();
    expect(adapter.toast.show).toHaveBeenCalledWith({
      severity: "warning",
      title: "navbar.userMenu.signOutOffline",
    });
  });

  it("after the Account was deleted, skips the server and discards the queue", async () => {
    await signOut({ accountDeleted: true });

    expect(steps).toEqual(["clear", "leave"]);
    expect(adapter.offlineEngine.clearForSignOut).toHaveBeenCalledWith({ discardQueue: true });
  });

  it("still leaves when clearing fails", async () => {
    vi.mocked(adapter.offlineEngine.clearForSignOut).mockRejectedValue(new Error("quota"));

    await signOut();

    expect(adapter.leave).toHaveBeenCalledOnce();
  });
});
