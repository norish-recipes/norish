import { describe, expect, it } from "vitest";

/**
 * Tests for session revalidation decision logic.
 *
 * The actual hook (`useSessionRevalidation`) uses React hooks and context,
 * so full integration tests need a React Native renderer. These tests
 * validate the pure decision logic as extracted functions.
 */

type RevalidationDecision = "sign-out" | "keep-session" | "retry-later";

function decideRevalidation(
  sessionValid: boolean | null,
  wasTransientError: boolean
): RevalidationDecision {
  if (wasTransientError) {
    // Transient error — don't sign out, retry next time
    return "retry-later";
  }

  if (sessionValid === null || sessionValid === false) {
    return "sign-out";
  }

  return "keep-session";
}

function shouldRevalidate(prevAppOnline: boolean, currentAppOnline: boolean): boolean {
  return !prevAppOnline && currentAppOnline;
}

describe("session revalidation", () => {
  describe("shouldRevalidate", () => {
    it("triggers when transitioning from offline to online", () => {
      expect(shouldRevalidate(false, true)).toBe(true);
    });

    it("does not trigger when staying online", () => {
      expect(shouldRevalidate(true, true)).toBe(false);
    });

    it("does not trigger when staying offline", () => {
      expect(shouldRevalidate(false, false)).toBe(false);
    });

    it("does not trigger when going offline", () => {
      expect(shouldRevalidate(true, false)).toBe(false);
    });
  });

  describe("decideRevalidation", () => {
    it("signs out when session is invalid", () => {
      expect(decideRevalidation(false, false)).toBe("sign-out");
    });

    it("signs out when session is null (expired)", () => {
      expect(decideRevalidation(null, false)).toBe("sign-out");
    });

    it("keeps session when valid", () => {
      expect(decideRevalidation(true, false)).toBe("keep-session");
    });

    it("retries later on transient error regardless of session state", () => {
      expect(decideRevalidation(false, true)).toBe("retry-later");
      expect(decideRevalidation(null, true)).toBe("retry-later");
      expect(decideRevalidation(true, true)).toBe("retry-later");
    });
  });
});
