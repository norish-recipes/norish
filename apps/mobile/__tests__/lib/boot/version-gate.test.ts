import {
  resolveForegroundVersionCheck,
  resolveLaunchVersionCheck,
  resolveUpdateServerAddress,
} from "@/lib/boot/boot-state";
import { describe, expect, it } from "vitest";

const address = "https://norish.example.com";
const tooOld = { outcome: "too-old", address, version: "0.26.2" } as const;
const newEnough = { outcome: "ok", address } as const;
const unreachable = { outcome: "error", messageId: "auth.connect.errors.unreachable" } as const;

describe("resolveLaunchVersionCheck", () => {
  it("sends a too old server to Update your server, with what it reported", () => {
    expect(resolveLaunchVersionCheck(tooOld, address, true)).toEqual({
      screen: "update-server",
      address,
      version: "0.26.2",
    });
  });

  it("waits for the launch to finish before leaving the first screen", () => {
    expect(resolveLaunchVersionCheck(tooOld, address, false)).toEqual({ screen: "wait" });
  });

  it("drops a too old result for an address that is no longer the saved one", () => {
    expect(resolveLaunchVersionCheck(tooOld, "https://other.example", true)).toEqual({
      screen: "continue",
    });
  });

  it("carries on when the server is new enough", () => {
    expect(resolveLaunchVersionCheck(newEnough, address, true)).toEqual({ screen: "continue" });
  });

  it("skips the check when the server is unreachable", () => {
    expect(resolveLaunchVersionCheck(unreachable, address, false)).toEqual({ screen: "continue" });
  });
});

describe("resolveForegroundVersionCheck", () => {
  it("continues to Sign in once the server is new enough, signed out, at the checked address", () => {
    expect(resolveForegroundVersionCheck(newEnough, false)).toEqual({ screen: "sign-in", address });
  });

  it("returns to the signed-in app once the server is new enough, signed in", () => {
    expect(resolveForegroundVersionCheck(newEnough, true)).toEqual({ screen: "signed-in-app" });
  });

  it("stays while the server is still too old", () => {
    expect(resolveForegroundVersionCheck(tooOld, false)).toEqual({ screen: "stay" });
    expect(resolveForegroundVersionCheck(tooOld, true)).toEqual({ screen: "stay" });
  });

  it("stays while the server is unreachable", () => {
    expect(resolveForegroundVersionCheck(unreachable, false)).toEqual({ screen: "stay" });
  });
});

describe("resolveUpdateServerAddress", () => {
  it("checks the address it was opened for", () => {
    expect(resolveUpdateServerAddress(address, "https://saved.example")).toEqual({
      screen: "update-server",
      address,
    });
  });

  it("falls back to the saved Server Address", () => {
    expect(resolveUpdateServerAddress(undefined, address)).toEqual({
      screen: "update-server",
      address,
    });
  });

  it("sends the reader to the signed-out entry with no address to check", () => {
    expect(resolveUpdateServerAddress(undefined, "")).toEqual({ screen: "signed-out-entry" });
    expect(resolveUpdateServerAddress("", "")).toEqual({ screen: "signed-out-entry" });
  });
});
