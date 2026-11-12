import { failedProviderName } from "@/features/auth/utils/failed-provider";
import { describe, expect, it } from "vitest";

import type { ProviderInfo } from "@norish/shared/contracts";

const google: ProviderInfo = { id: "google", name: "Google", icon: "", type: "oauth" };
const pocket: ProviderInfo = { id: "pocket-id", name: "Pocket ID", icon: "" };
const credential: ProviderInfo = {
  id: "credential",
  name: "Password",
  icon: "",
  type: "credential",
};
const providers = [credential, google, pocket];

describe("failedProviderName", () => {
  it("names the route's provider by its display name", () => {
    expect(failedProviderName("pocket-id", undefined, providers)).toBe("Pocket ID");
  });

  it("falls back to the last provider tried when the route has none", () => {
    expect(failedProviderName(undefined, "google", providers)).toBe("Google");
  });

  it("prefers the route's provider over the last tried", () => {
    expect(failedProviderName("pocket-id", "google", providers)).toBe("Pocket ID");
  });

  it("skips a route provider the server doesn't list and uses the one tried", () => {
    expect(failedProviderName("gone", "google", providers)).toBe("Google");
  });

  it("leaves the line unnamed when no provider is known", () => {
    expect(failedProviderName(undefined, undefined, providers)).toBeNull();
    expect(failedProviderName("gone", "also-gone", providers)).toBeNull();
    expect(failedProviderName("google", undefined, [])).toBeNull();
  });

  it("never names the password method", () => {
    expect(failedProviderName("credential", undefined, providers)).toBeNull();
  });
});
