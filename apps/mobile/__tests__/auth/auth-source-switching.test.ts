import { describe, expect, it } from "vitest";

/**
 * Tests for auth source switching decision logic.
 *
 * The actual `AuthProviderInner` component uses React hooks and context,
 * so full integration tests require a React Native renderer. These tests
 * validate the pure decision logic as extracted functions mirroring the
 * implementation in auth-context.tsx.
 */

type AuthSource = "live" | "persisted" | "initializing";
type RuntimeState = "initializing" | "ready";

/** Mirrors the `currentSource` derivation in AuthProviderInner. */
function deriveCurrentSource(runtimeState: RuntimeState, backendReachable: boolean): AuthSource {
  if (runtimeState === "initializing") {
    return "initializing";
  }

  if (backendReachable) {
    return "live";
  }

  return "persisted";
}

/**
 * Mirrors the authSourceRef update logic in AuthProviderInner.
 * Returns the effective source after applying transition guards.
 */
function deriveEffectiveSource(
  currentSource: AuthSource,
  previousEffective: AuthSource,
  hasLiveSession: boolean
): AuthSource {
  if (currentSource === "live") {
    return "live";
  }

  if (currentSource === "initializing") {
    // Keep live if we had it, otherwise stay initializing
    return previousEffective === "live" ? "live" : "initializing";
  }

  // persisted — only switch if we're not in a live session already
  if (previousEffective === "live" && hasLiveSession) {
    return "live"; // keep live to prevent flicker on transient disconnect
  }

  return "persisted";
}

describe("auth source switching", () => {
  describe("deriveCurrentSource", () => {
    it("returns initializing when runtimeState is initializing", () => {
      expect(deriveCurrentSource("initializing", false)).toBe("initializing");
      expect(deriveCurrentSource("initializing", true)).toBe("initializing");
    });

    it("returns live when ready and backend is reachable", () => {
      expect(deriveCurrentSource("ready", true)).toBe("live");
    });

    it("returns persisted when ready and backend is unreachable", () => {
      expect(deriveCurrentSource("ready", false)).toBe("persisted");
    });
  });

  describe("deriveEffectiveSource", () => {
    it("cold start unreachable with persisted session → persisted", () => {
      // Startup: initializing → persisted
      const step1 = deriveEffectiveSource("initializing", "initializing", false);
      expect(step1).toBe("initializing");

      // runtimeState settles, still unreachable
      const step2 = deriveEffectiveSource("persisted", step1, false);
      expect(step2).toBe("persisted");
    });

    it("cold start reachable → live session path", () => {
      // Startup: initializing → live
      const step1 = deriveEffectiveSource("initializing", "initializing", false);
      expect(step1).toBe("initializing");

      // runtimeState settles, backend reachable
      const step2 = deriveEffectiveSource("live", step1, false);
      expect(step2).toBe("live");
    });

    it("reachable → unreachable keeps live when session exists (no flicker)", () => {
      // Start live with a session
      const step1 = deriveEffectiveSource("live", "initializing", true);
      expect(step1).toBe("live");

      // Backend becomes unreachable, but we have a live session — keep it
      const step2 = deriveEffectiveSource("persisted", step1, true);
      expect(step2).toBe("live");
    });

    it("unreachable → reachable transitions to live", () => {
      // Start persisted (offline)
      const step1 = deriveEffectiveSource("persisted", "initializing", false);
      expect(step1).toBe("persisted");

      // Backend becomes reachable
      const step2 = deriveEffectiveSource("live", step1, false);
      expect(step2).toBe("live");
    });

    it("reachable → unreachable → reachable full cycle", () => {
      // Start live
      const step1 = deriveEffectiveSource("live", "initializing", true);
      expect(step1).toBe("live");

      // Goes unreachable (live session kept)
      const step2 = deriveEffectiveSource("persisted", step1, true);
      expect(step2).toBe("live");

      // Comes back reachable
      const step3 = deriveEffectiveSource("live", step2, true);
      expect(step3).toBe("live");
    });

    it("unreachable with no live session falls to persisted", () => {
      // Was live but session expired / signed out
      const step1 = deriveEffectiveSource("live", "initializing", false);
      expect(step1).toBe("live");

      // Backend unreachable, no session — should fall to persisted
      const step2 = deriveEffectiveSource("persisted", step1, false);
      expect(step2).toBe("persisted");
    });

    it("initializing phase preserves live source if already established", () => {
      // Somehow we had a live session, and runtimeState re-initializes
      const result = deriveEffectiveSource("initializing", "live", true);
      expect(result).toBe("live");
    });

    it("always switches to live when currentSource is live", () => {
      expect(deriveEffectiveSource("live", "initializing", false)).toBe("live");
      expect(deriveEffectiveSource("live", "persisted", false)).toBe("live");
      expect(deriveEffectiveSource("live", "live", true)).toBe("live");
    });
  });
});
