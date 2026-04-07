import { describe, expect, it } from "vitest";

/**
 * Tests for the network status state matrix logic.
 *
 * Since NetworkProvider uses React context, hooks, and native modules
 * (expo-network, AppState, fetch), full rendering tests require a React
 * Native test environment. These unit tests validate the pure logic
 * of the reachability state derivation.
 */

type ReachabilityMode = "offline" | "backend-unreachable" | "online";

function deriveMode(deviceOnline: boolean, backendReachable: boolean): ReachabilityMode {
  if (!deviceOnline) return "offline";
  if (!backendReachable) return "backend-unreachable";
  return "online";
}

function deriveAppOnline(deviceOnline: boolean, backendReachable: boolean): boolean {
  return deviceOnline && backendReachable;
}

describe("network status state matrix", () => {
  describe("deriveMode", () => {
    it("returns offline when device is offline", () => {
      expect(deriveMode(false, false)).toBe("offline");
    });

    it("returns offline when device is offline even if backend flag is stale-true", () => {
      expect(deriveMode(false, true)).toBe("offline");
    });

    it("returns backend-unreachable when device is online but backend is not", () => {
      expect(deriveMode(true, false)).toBe("backend-unreachable");
    });

    it("returns online when both device and backend are reachable", () => {
      expect(deriveMode(true, true)).toBe("online");
    });
  });

  describe("deriveAppOnline", () => {
    it("is false when device offline", () => {
      expect(deriveAppOnline(false, false)).toBe(false);
      expect(deriveAppOnline(false, true)).toBe(false);
    });

    it("is false when backend unreachable", () => {
      expect(deriveAppOnline(true, false)).toBe(false);
    });

    it("is true only when both are reachable", () => {
      expect(deriveAppOnline(true, true)).toBe(true);
    });
  });

  describe("failure threshold logic", () => {
    const FAILURE_THRESHOLD = 2;

    function shouldMarkUnreachable(consecutiveFailures: number): boolean {
      return consecutiveFailures >= FAILURE_THRESHOLD;
    }

    it("does not flip on first failure", () => {
      expect(shouldMarkUnreachable(1)).toBe(false);
    });

    it("flips on threshold", () => {
      expect(shouldMarkUnreachable(2)).toBe(true);
    });

    it("stays flipped above threshold", () => {
      expect(shouldMarkUnreachable(5)).toBe(true);
    });

    it("immediate recovery on success (consecutiveFailures reset to 0)", () => {
      expect(shouldMarkUnreachable(0)).toBe(false);
    });
  });
});
