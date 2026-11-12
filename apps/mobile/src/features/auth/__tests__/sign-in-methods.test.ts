import { resolveMethodsStatus, resolveSignInMethods } from "@/features/auth/utils/sign-in-methods";
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
      providerButtons: true,
      divider: true,
      signUp: true,
      noMethod: false,
    });
  });

  it("drops the divider when only the password form shows", () => {
    expect(
      resolveSignInMethods({
        providers: [credential],
        passwordAuthEnabled: true,
        registrationEnabled: false,
      })
    ).toEqual({
      passwordForm: true,
      oauthProviders: [],
      providerButtons: false,
      divider: false,
      signUp: false,
      noMethod: false,
    });
  });

  it("shows only the providers, and no Sign up, without password sign-in", () => {
    expect(
      resolveSignInMethods({
        providers: [google],
        passwordAuthEnabled: false,
        registrationEnabled: true,
      })
    ).toEqual({
      passwordForm: false,
      oauthProviders: [google],
      providerButtons: true,
      divider: false,
      signUp: false,
      noMethod: false,
    });
  });

  it("shows nothing when the server offers no method, a credential provider included", () => {
    expect(
      resolveSignInMethods({
        providers: [credential],
        passwordAuthEnabled: false,
        registrationEnabled: true,
      })
    ).toEqual({
      passwordForm: false,
      oauthProviders: [],
      providerButtons: false,
      divider: false,
      signUp: false,
      noMethod: true,
    });
  });
});

describe("resolveMethodsStatus", () => {
  const settled = { isLoading: false, isPaused: false, error: null, hasData: false };

  it("loads while the first fetch runs", () => {
    expect(resolveMethodsStatus({ ...settled, isLoading: true })).toBe("loading");
  });

  it("fails when the first fetch errored or is paused offline with nothing cached", () => {
    expect(resolveMethodsStatus({ ...settled, error: new Error("x") })).toBe("failed");
    expect(resolveMethodsStatus({ ...settled, isPaused: true })).toBe("failed");
  });

  it("keeps loaded methods up through a failed or paused refetch", () => {
    expect(resolveMethodsStatus({ ...settled, hasData: true, error: new Error("x") })).toBe(
      "ready"
    );
    expect(resolveMethodsStatus({ ...settled, hasData: true, isPaused: true })).toBe("ready");
  });
});
