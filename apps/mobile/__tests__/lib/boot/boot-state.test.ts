import {
  fadesInAfterSessionEnd,
  resolveBootPhase,
  resolveLaunchMotion,
  resolveSignedOutEntry,
  stepLaunchClock,
} from "@/lib/boot/boot-state";
import { describe, expect, it } from "vitest";

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
          fontsReady: true,
          serverAddress: ready,
        })
      ).toEqual({ phase: "loading" });
    });

    it("waits while the fonts are still loading", () => {
      expect(
        resolveBootPhase({
          appearanceHydrated: true,
          fontsReady: false,
          serverAddress: ready,
        })
      ).toEqual({ phase: "loading" });
    });

    it("waits while the Server Address is still being read", () => {
      expect(
        resolveBootPhase({
          appearanceHydrated: true,
          fontsReady: true,
          serverAddress: loading,
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
          fontsReady: true,
          serverAddress: { status: "error", error },
        })
      ).toEqual({ phase: "storage-error", error });
    });

    it("never reports onboarding for an unreadable store", () => {
      // Regression guard: treating a failed read as "no Server Address"
      // would send a user with a working server back through setup.
      const phase = resolveBootPhase({
        appearanceHydrated: true,
        fontsReady: true,
        serverAddress: { status: "error", error: new Error("keychain locked") },
      });

      expect(phase.phase).not.toBe("onboarding");
    });

    it("takes precedence over a hydrated-but-empty read ordering", () => {
      const error = new Error("keychain locked");

      expect(
        resolveBootPhase({
          appearanceHydrated: true,
          fontsReady: true,
          serverAddress: { status: "error", error },
        }).phase
      ).toBe("storage-error");
    });
  });

  describe("onboarding", () => {
    it("onboards when storage is readable and holds no Server Address", () => {
      expect(
        resolveBootPhase({
          appearanceHydrated: true,
          fontsReady: true,
          serverAddress: unconfigured,
        })
      ).toEqual({ phase: "onboarding" });
    });
  });

  describe("ready", () => {
    it("passes the saved Server Address through once everything settled", () => {
      expect(
        resolveBootPhase({
          appearanceHydrated: true,
          fontsReady: true,
          serverAddress: ready,
        })
      ).toEqual({ phase: "ready", serverAddress: "https://norish.example" });
    });

    it("still waits for the other inputs even with a Server Address in hand", () => {
      expect(
        resolveBootPhase({
          appearanceHydrated: false,
          fontsReady: true,
          serverAddress: ready,
        })
      ).toEqual({ phase: "loading" });
    });
  });
});

describe("resolveLaunchMotion", () => {
  it("holds while the boot phase has no handoff yet", () => {
    expect(resolveLaunchMotion(null, false, 120)).toBeNull();
  });

  it("glides when Server address has measured its brand", () => {
    expect(resolveLaunchMotion("glide", false, 120)).toBe("glide");
  });

  it("fades when no glide target arrived by the end of the hold", () => {
    expect(resolveLaunchMotion("glide", false, null)).toBe("fade");
  });

  it("fades under Reduce Motion and for every other handoff", () => {
    expect(resolveLaunchMotion("glide", true, 120)).toBe("fade");
    expect(resolveLaunchMotion("fade", false, 120)).toBe("fade");
  });
});

describe("resolveSignedOutEntry", () => {
  it("opens on Server address with no Server Address saved", () => {
    expect(resolveSignedOutEntry("", false)).toBe("server-address");
  });

  it("opens on Sign in once a Server Address is saved", () => {
    expect(resolveSignedOutEntry("https://norish.example", false)).toBe("sign-in");
  });

  it("opens on Server address when the reader asked to change the saved one", () => {
    expect(resolveSignedOutEntry("https://norish.example", true)).toBe("server-address");
  });
});

describe("stepLaunchClock", () => {
  it("advances by the frame's elapsed time", () => {
    expect(stepLaunchClock(100, 16.7, 900)).toBeCloseTo(116.7);
  });

  it("advances at most two 60 Hz frames, so a stalled frame can't skip the launch", () => {
    expect(stepLaunchClock(0, 195, 900)).toBeCloseTo(1000 / 30);
  });

  it("stops at the stop point", () => {
    expect(stepLaunchClock(890, 16.7, 900)).toBe(900);
  });

  it("stays put on a frame with no elapsed time yet", () => {
    expect(stepLaunchClock(100, null, 900)).toBe(100);
  });

  it("never moves back when the stop point is behind it", () => {
    expect(stepLaunchClock(1200, 16.7, 900)).toBe(1200);
  });
});

describe("fadesInAfterSessionEnd", () => {
  const address = "https://norish.example";

  it("fades in the screen a session end lands on, for the Server Address it left", () => {
    expect(fadesInAfterSessionEnd(address, address)).toBe(true);
  });

  it("cuts on a launch, or a Server Address change made while signed out", () => {
    expect(fadesInAfterSessionEnd(null, address)).toBe(false);
  });

  it("cuts once the Server Address changed since the session ended", () => {
    expect(fadesInAfterSessionEnd(address, "https://other.example")).toBe(false);
  });
});
