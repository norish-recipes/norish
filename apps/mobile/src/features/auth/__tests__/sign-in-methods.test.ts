import { resolveSignInMethods } from "@/features/auth/utils/sign-in-methods";
import { describe, expect, it } from "vitest";

import type { ProviderInfo } from "@norish/shared/contracts";

const credential: ProviderInfo = { id: "credential", name: "Email", icon: "", type: "credential" };
const google: ProviderInfo = { id: "google", name: "Google", icon: "", type: "oauth" };
const github: ProviderInfo = { id: "github", name: "GitHub", icon: "" };

describe("resolveSignInMethods", () => {
  it("shows the password form, the divider and every provider when the server offers both", () => {
    expect(
      resolveSignInMethods({
        providers: [credential, google, github],
        passwordAuthEnabled: true,
        registrationEnabled: true,
      })
    ).toEqual({
      passwordForm: true,
      oauthProviders: [google, github],
      divider: true,
      signUp: true,
    });
  });

  it("drops the divider when only the password form shows", () => {
    expect(
      resolveSignInMethods({
        providers: [credential],
        passwordAuthEnabled: true,
        registrationEnabled: false,
      })
    ).toEqual({ passwordForm: true, oauthProviders: [], divider: false, signUp: false });
  });

  it("shows only the providers, and no Sign up, without password sign-in", () => {
    expect(
      resolveSignInMethods({
        providers: [google],
        passwordAuthEnabled: false,
        registrationEnabled: true,
      })
    ).toEqual({ passwordForm: false, oauthProviders: [google], divider: false, signUp: false });
  });

  it("shows nothing when the server offers no method", () => {
    expect(
      resolveSignInMethods({ providers: [], passwordAuthEnabled: false, registrationEnabled: true })
    ).toEqual({ passwordForm: false, oauthProviders: [], divider: false, signUp: false });
  });
});
