import { resolveForegroundVersionCheck, resolveLaunchVersionCheck } from "@/lib/boot/boot-state";
import { describe, expect, it } from "vitest";

const address = "https://norish.example.com";
const tooOld = { outcome: "too-old", address, version: "0.26.2" } as const;
const newEnough = { outcome: "ok", address } as const;
const unreachable = { outcome: "error", messageId: "auth.connect.errors.unreachable" } as const;

describe("resolveLaunchVersionCheck", () => {
  it("sends a too old server to Update your server, with what it reported", () => {
    expect(resolveLaunchVersionCheck(tooOld)).toEqual({
      screen: "update-server",
      address,
      version: "0.26.2",
    });
  });

  it("carries on when the server is new enough", () => {
    expect(resolveLaunchVersionCheck(newEnough)).toEqual({ screen: "continue" });
  });

  it("skips the check when the server is unreachable", () => {
    expect(resolveLaunchVersionCheck(unreachable)).toEqual({ screen: "continue" });
  });
});

describe("resolveForegroundVersionCheck", () => {
  it("continues to Sign in once the server is new enough, at the checked address", () => {
    expect(resolveForegroundVersionCheck(newEnough)).toEqual({ screen: "continue", address });
  });

  it("stays while the server is still too old", () => {
    expect(resolveForegroundVersionCheck(tooOld)).toEqual({ screen: "stay" });
  });

  it("stays while the server is unreachable", () => {
    expect(resolveForegroundVersionCheck(unreachable)).toEqual({ screen: "stay" });
  });
});
