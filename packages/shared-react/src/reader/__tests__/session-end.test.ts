import { createElement } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SignOutOptions } from "@norish/shared-react/reader";
import { PlatformProvider } from "@norish/shared-react/platform";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";
import { expireSession, useSessionExpiry, useSignOut } from "@norish/shared-react/reader";

const connectivity = vi.hoisted(() => ({ isOffline: false }));

vi.mock("../../offline/react/connectivity", () => ({ useConnectivity: () => connectivity }));

/** A promise the test settles by hand. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));

  return { promise, resolve };
}

describe("Sign-out and Session Expiry", () => {
  let adapter: ReturnType<typeof fakePlatformAdapter>;
  let steps: string[];
  let unmounts: (() => void)[];

  const wrapper = () => createTestWrapper(createTestQueryClient(), adapter);
  const signOut = (options?: SignOutOptions) =>
    renderHook(() => useSignOut(), { wrapper: wrapper() }).result.current(options);
  const mountExpiry = () =>
    unmounts.push(renderHook(() => useSessionExpiry(), { wrapper: wrapper() }).unmount);

  beforeEach(() => {
    steps = [];
    unmounts = [];
    connectivity.isOffline = false;
    adapter = fakePlatformAdapter();
    vi.mocked(adapter.endSession).mockImplementation(async () => void steps.push("end"));
    vi.mocked(adapter.offlineEngine.clearForSignOut).mockImplementation(
      async ({ discardQueue }) => void steps.push(discardQueue ? "clear+discard" : "clear")
    );
    vi.mocked(adapter.leave).mockImplementation((reason) => void steps.push(`leave:${reason}`));
  });

  afterEach(() => unmounts.forEach((unmount) => unmount()));

  describe("useSignOut", () => {
    it("ends the session, then clears the Offline Cache keeping the queue, then leaves", async () => {
      await signOut();

      expect(steps).toEqual(["end", "clear", "leave:sign-out"]);
      expect(adapter.endSession).toHaveBeenCalledExactlyOnceWith("everywhere");
    });

    it("discards the queue once the reader agreed to", async () => {
      await signOut({ discardQueue: true });

      expect(steps).toEqual(["end", "clear+discard", "leave:sign-out"]);
    });

    it("while Offline, clears nothing and says the reader is offline", async () => {
      connectivity.isOffline = true;
      vi.mocked(adapter.endSession).mockRejectedValue(new Error("offline"));

      await signOut({ discardQueue: true });

      expect(steps).toEqual([]);
      expect(adapter.toast.show).toHaveBeenCalledWith({
        severity: "warning",
        title: "navbar.userMenu.signOutOffline",
      });
      expect(adapter.showError).not.toHaveBeenCalled();
    });

    it("while Live, clears nothing and shows the server's failure as an error", async () => {
      const error = new Error("500");

      vi.mocked(adapter.endSession).mockRejectedValue(error);

      await signOut();

      expect(steps).toEqual([]);
      expect(adapter.showError).toHaveBeenCalledWith(error, "auth:sign-out");
      expect(adapter.toast.show).not.toHaveBeenCalled();
    });

    it("still leaves when clearing fails", async () => {
      vi.mocked(adapter.offlineEngine.clearForSignOut).mockRejectedValue(new Error("quota"));

      await signOut();

      expect(adapter.leave).toHaveBeenCalledExactlyOnceWith("sign-out");
    });
  });

  describe("Session Expiry", () => {
    it("drops the device's session, clears keeping the queue, then leaves", async () => {
      mountExpiry();

      await expireSession();

      expect(steps).toEqual(["end", "clear", "leave:expiry"]);
      expect(adapter.endSession).toHaveBeenCalledExactlyOnceWith("device");
    });

    it("still runs after the shell re-renders with a new platform", async () => {
      let current = adapter;
      const { rerender, unmount } = renderHook(() => useSessionExpiry(), {
        wrapper: ({ children }) => createElement(PlatformProvider, { adapter: current }, children),
      });

      unmounts.push(unmount);
      current = { ...adapter, endSession: vi.fn(async () => void steps.push("end:new")) };
      rerender();
      await expireSession();

      expect(steps).toEqual(["end:new", "clear", "leave:expiry"]);
    });

    it("keeps the queue and still clears and leaves when the device's session cannot be dropped", async () => {
      vi.mocked(adapter.endSession).mockRejectedValue(new Error("401"));
      mountExpiry();

      await expireSession();

      expect(steps).toEqual(["clear", "leave:expiry"]);
      expect(adapter.showError).not.toHaveBeenCalled();
    });

    it("does nothing while no signed-in shell mounted it", async () => {
      const { unmount } = renderHook(() => useSessionExpiry(), { wrapper: wrapper() });

      unmount();
      await expireSession();

      expect(steps).toEqual([]);
    });

    it("an expiry arriving while a sign-out clears neither clears nor leaves again", async () => {
      const clearing = deferred();

      vi.mocked(adapter.offlineEngine.clearForSignOut).mockImplementation(
        async ({ discardQueue }) => {
          steps.push(discardQueue ? "clear+discard" : "clear");
          await clearing.promise;
        }
      );
      mountExpiry();

      const signingOut = signOut({ discardQueue: true });

      await vi.waitFor(() => expect(steps).toContain("clear+discard"));
      await expireSession();
      clearing.resolve();
      await signingOut;

      expect(steps).toEqual(["end", "clear+discard", "leave:sign-out"]);
    });

    it("a sign-out during an expiry is ignored", async () => {
      const ending = deferred();

      vi.mocked(adapter.endSession).mockImplementation(async () => {
        steps.push("end");
        await ending.promise;
      });
      mountExpiry();

      const expiring = expireSession();
      const signingOut = signOut({ discardQueue: true });

      ending.resolve();
      await Promise.all([expiring, signingOut]);

      expect(steps).toEqual(["end", "clear", "leave:expiry"]);
    });

    it("two expiries run once", async () => {
      mountExpiry();

      await Promise.all([expireSession(), expireSession()]);

      expect(steps).toEqual(["end", "clear", "leave:expiry"]);
    });

    it("an expiry asked for during a sign-out that fails runs once it settles", async () => {
      const ending = deferred();

      vi.mocked(adapter.endSession).mockImplementation(async (scope) => {
        steps.push(`end:${scope}`);
        if (scope === "everywhere") {
          await ending.promise;
          throw new Error("401");
        }
      });
      mountExpiry();

      const signingOut = signOut();

      await vi.waitFor(() => expect(steps).toContain("end:everywhere"));
      await expireSession();
      expireSession();
      ending.resolve();
      await signingOut;

      expect(steps).toEqual(["end:everywhere", "end:device", "clear", "leave:expiry"]);
    });

    it("runs again once the previous sequence settled", async () => {
      mountExpiry();

      await signOut();
      await expireSession();

      expect(steps).toEqual(["end", "clear", "leave:sign-out", "end", "clear", "leave:expiry"]);
    });
  });
});
