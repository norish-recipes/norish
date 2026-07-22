import {
  isOfflineForced,
  OFFLINE_FORCED_AVAILABLE,
  setOfflineForced,
  subscribeOfflineForced,
} from "@/lib/connectivity/forced-offline";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("forced-offline flag", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is available under the test/dev NODE_ENV", () => {
    expect(OFFLINE_FORCED_AVAILABLE).toBe(true);
  });

  it("reads false by default", () => {
    expect(isOfflineForced()).toBe(false);
  });

  it("round-trips through localStorage", () => {
    setOfflineForced(true);
    expect(isOfflineForced()).toBe(true);
    expect(window.localStorage.getItem("norish.dev.offline-forced")).toBe("1");

    setOfflineForced(false);
    expect(isOfflineForced()).toBe(false);
    expect(window.localStorage.getItem("norish.dev.offline-forced")).toBeNull();
  });

  it("notifies same-tab subscribers on change and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOfflineForced(listener);

    setOfflineForced(true);
    expect(listener).toHaveBeenCalledTimes(1);

    setOfflineForced(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setOfflineForced(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("notifies subscribers of a cross-tab change (storage event)", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOfflineForced(listener);

    window.dispatchEvent(new StorageEvent("storage", { key: "norish.dev.offline-forced" }));
    expect(listener).toHaveBeenCalledTimes(1);

    // An unrelated key must not wake the listener.
    window.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  describe("production gating (ADR-0007)", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("strips the affordance: never forced even if the flag is present", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.resetModules();

      const prod = await import("@/lib/connectivity/forced-offline");

      expect(prod.OFFLINE_FORCED_AVAILABLE).toBe(false);

      window.localStorage.setItem("norish.dev.offline-forced", "1");
      expect(prod.isOfflineForced()).toBe(false);

      // Setting is a no-op in production.
      prod.setOfflineForced(true);
      expect(prod.isOfflineForced()).toBe(false);
    });
  });
});
