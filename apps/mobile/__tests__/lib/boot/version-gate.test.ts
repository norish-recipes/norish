import {
  resolveForegroundVersionCheck,
  resolveLaunchVersionCheck,
  resolveServerChange,
  resolveUpdateServerAddress,
} from "@/lib/boot/boot-state";
import { describe, expect, it } from "vitest";

const address = "https://norish.example.com";
const tooOld = { outcome: "too-old", address, version: "0.26.2" } as const;
const newEnough = { outcome: "ok", address } as const;
const unreachable = { outcome: "error", messageId: "auth.connect.errors.unreachable" } as const;

describe("resolveLaunchVersionCheck", () => {
  const updateServer = { screen: "update-server", address, version: "0.26.2" };

  it("opens Update your server at once, unanimated, while the splash still covers the screen", () => {
    expect(resolveLaunchVersionCheck(tooOld, address, "covered")).toEqual({
      ...updateServer,
      animated: false,
    });
  });

  it("waits while the splash fades or glides away, so the screen it reveals isn't replaced", () => {
    expect(resolveLaunchVersionCheck(tooOld, address, "leaving")).toEqual({ screen: "wait" });
  });

  it("opens Update your server at once once the launch has finished", () => {
    expect(resolveLaunchVersionCheck(tooOld, address, "done")).toEqual({
      ...updateServer,
      animated: true,
    });
  });

  it("drops a too old result for an address that is no longer the saved one", () => {
    expect(resolveLaunchVersionCheck(tooOld, "https://other.example", "done")).toEqual({
      screen: "continue",
    });
  });

  it("carries on when the server is new enough", () => {
    expect(resolveLaunchVersionCheck(newEnough, address, "covered")).toEqual({
      screen: "continue",
    });
  });

  it("skips the check when the server is unreachable", () => {
    expect(resolveLaunchVersionCheck(unreachable, address, "leaving")).toEqual({
      screen: "continue",
    });
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

describe("resolveServerChange", () => {
  it("opens Server address while signed out", () => {
    expect(resolveServerChange(false)).toBe("server-address");
  });

  it("signs out first while signed in", () => {
    expect(resolveServerChange(true)).toBe("sign-out-first");
  });
});
