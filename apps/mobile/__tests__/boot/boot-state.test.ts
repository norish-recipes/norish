import { describe, expect, it } from "vitest";

import { resolveBootPhase } from "../../src/lib/boot/boot-state";

/**
 * The boot gate lives in a React component tree that needs native modules to
 * render, so only its decision function is exercised here. That function is
 * where the interesting behaviour is: it decides between waiting, reporting a
 * storage failure, onboarding, and the full app.
 */

const ready = { status: "ready", url: "https://norish.example" } as const;
const unconfigured = { status: "ready", url: null } as const;
const loading = { status: "loading" } as const;

describe("resolveBootPhase", () => {
  describe("loading", () => {
    it("waits while the appearance preference is unhydrated", () => {
      expect(
        resolveBootPhase({
          appearanceHydrated: false,
          cacheReady: true,
          backendBaseUrl: ready,
        })
      ).toEqual({ phase: "loading" });
    });

    it("waits while the query cache is still settling", () => {
      expect(
        resolveBootPhase({
          appearanceHydrated: true,
          cacheReady: false,
          backendBaseUrl: ready,
        })
      ).toEqual({ phase: "loading" });
    });

    it("waits while the backend URL is still being read", () => {
      expect(
        resolveBootPhase({
          appearanceHydrated: true,
          cacheReady: true,
          backendBaseUrl: loading,
        })
      ).toEqual({ phase: "loading" });
    });
  });

  describe("storage failure", () => {
    it("reports the failure instead of waiting forever", () => {
      const error = new Error("A required entitlement isn't present.");

      expect(
        resolveBootPhase({
          appearanceHydrated: true,
          cacheReady: true,
          backendBaseUrl: { status: "error", error },
        })
      ).toEqual({ phase: "storage-error", error });
    });

    it("never reports onboarding for an unreadable store", () => {
      // Regression guard: treating a failed read as "no backend configured"
      // would send a user with a working server back through setup.
      const phase = resolveBootPhase({
        appearanceHydrated: true,
        cacheReady: true,
        backendBaseUrl: { status: "error", error: new Error("keychain locked") },
      });

      expect(phase.phase).not.toBe("onboarding");
    });

    it("takes precedence over a hydrated-but-empty read ordering", () => {
      const error = new Error("keychain locked");

      expect(
        resolveBootPhase({
          appearanceHydrated: true,
          cacheReady: true,
          backendBaseUrl: { status: "error", error },
        }).phase
      ).toBe("storage-error");
    });
  });

  describe("onboarding", () => {
    it("onboards when storage is readable and holds no backend", () => {
      expect(
        resolveBootPhase({
          appearanceHydrated: true,
          cacheReady: true,
          backendBaseUrl: unconfigured,
        })
      ).toEqual({ phase: "onboarding" });
    });
  });

  describe("ready", () => {
    it("passes the configured backend through once everything settled", () => {
      expect(
        resolveBootPhase({
          appearanceHydrated: true,
          cacheReady: true,
          backendBaseUrl: ready,
        })
      ).toEqual({ phase: "ready", backendBaseUrl: "https://norish.example" });
    });

    it("still waits for the other inputs even with a backend in hand", () => {
      expect(
        resolveBootPhase({
          appearanceHydrated: false,
          cacheReady: false,
          backendBaseUrl: ready,
        })
      ).toEqual({ phase: "loading" });
    });
  });
});
