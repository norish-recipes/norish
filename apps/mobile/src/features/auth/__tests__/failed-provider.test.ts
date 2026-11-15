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
    expect(failedProviderName("pocket-id", providers, true)).toBe("Pocket ID");
  });

  it("leaves the line unnamed with no route provider or one the server doesn't list", () => {
    expect(failedProviderName(undefined, providers, true)).toBeNull();
    expect(failedProviderName("gone", providers, true)).toBeNull();
    expect(failedProviderName("google", [], true)).toBeNull();
  });

  it("never names the password method", () => {
    expect(failedProviderName("credential", providers, true)).toBeNull();
  });

  it("decides nothing until the provider list has settled", () => {
    expect(failedProviderName("google", [], false)).toBeUndefined();
    expect(failedProviderName(undefined, [], false)).toBeUndefined();
  });
});
