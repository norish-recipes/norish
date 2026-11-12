import {
  resolveForegroundVersionCheck,
  resolveLaunchVersionCheck,
  resolveSavedServerContinue,
  resolveTooOldServerRoute,
  resolveUpdateServerRoute,
} from "@/lib/boot/version-gate";
import { describe, expect, it } from "vitest";

const address = "https://norish.example.com";
const tooOld = { outcome: "too-old", address, version: "0.26.2" } as const;
const newEnough = { outcome: "ok", address } as const;
const unreachable = { outcome: "error", reason: "unreachable" } as const;

describe("resolveLaunchVersionCheck", () => {
  it("holds Update your server for a too old saved address", () => {
    expect(resolveLaunchVersionCheck(tooOld, address)).toEqual({
      screen: "update-server",
      address,
      version: "0.26.2",
    });
  });

  it("drops a too old result for an address that is no longer the saved one", () => {
    expect(resolveLaunchVersionCheck(tooOld, "https://other.example")).toEqual({
      screen: "continue",
    });
  });

  it("carries on when the server is new enough", () => {
    expect(resolveLaunchVersionCheck(newEnough, address)).toEqual({ screen: "continue" });
  });

  it("skips the check when the server is unreachable", () => {
    expect(resolveLaunchVersionCheck(unreachable, address)).toEqual({ screen: "continue" });
  });
});

describe("resolveTooOldServerRoute", () => {
  const held = { address, version: "0.26.2" };
  const updateServer = { screen: "update-server", address, version: "0.26.2" };

  it("opens Update your server at once, unanimated, while the splash still covers the screen", () => {
    expect(resolveTooOldServerRoute(held, false, "covered")).toEqual({
      ...updateServer,
      animated: false,
    });
  });

  it("waits while the splash fades or glides away, so the screen it reveals isn't replaced", () => {
    expect(resolveTooOldServerRoute(held, false, "leaving")).toEqual({ screen: "stay" });
  });

  it("opens Update your server, animated, once the launch has finished", () => {
    expect(resolveTooOldServerRoute(held, false, "done")).toEqual({
      ...updateServer,
      animated: true,
    });
  });

  it("stays where it is while Update your server already shows", () => {
    expect(resolveTooOldServerRoute(held, true, "done")).toEqual({ screen: "stay" });
  });

  it("stays where it is when no address is held too old", () => {
    expect(resolveTooOldServerRoute(null, false, "done")).toEqual({ screen: "stay" });
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

describe("resolveUpdateServerRoute", () => {
  const held = { address, version: "0.26.2" };
  const updateServer = { screen: "update-server", address, version: "0.26.2" };

  it("shows Update your server for an address a check found too old", () => {
    expect(resolveUpdateServerRoute(address, "https://saved.example", held, null)).toEqual(
      updateServer
    );
  });

  it("checks an address it knows nothing about first, as from a deep link", () => {
    expect(resolveUpdateServerRoute(address, "", null, null)).toEqual({ screen: "check", address });
    expect(
      resolveUpdateServerRoute(undefined, address, { address: "https://other.example" }, null)
    ).toEqual({ screen: "check", address });
  });

  it("shows Update your server once that check answers too old", () => {
    expect(resolveUpdateServerRoute(undefined, address, null, tooOld)).toEqual(updateServer);
  });

  it("leaves for where the reader belongs once the server is new enough or unreachable", () => {
    expect(resolveUpdateServerRoute(address, "", null, newEnough)).toEqual({ screen: "leave" });
    expect(resolveUpdateServerRoute(address, "", null, unreachable)).toEqual({ screen: "leave" });
  });

  it("leaves with no address to check", () => {
    expect(resolveUpdateServerRoute(undefined, "", null, null)).toEqual({ screen: "leave" });
    expect(resolveUpdateServerRoute("", "", null, null)).toEqual({ screen: "leave" });
  });
});

describe("resolveSavedServerContinue", () => {
  it("dismisses back to the screen beneath when it is Sign in for the saved address", () => {
    expect(resolveSavedServerContinue(true, true)).toEqual({ dismiss: true, signIn: false });
  });

  it("goes on to Sign in for an address not saved yet, or with nothing beneath", () => {
    expect(resolveSavedServerContinue(false, true)).toEqual({ dismiss: true, signIn: true });
    expect(resolveSavedServerContinue(true, false)).toEqual({ dismiss: false, signIn: true });
  });
});
