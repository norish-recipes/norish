// @vitest-environment node
/** The sign-in route signs straight in only when one OAuth provider is all there is. */
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ProviderInfo } from "@norish/shared/contracts";

const providers = vi.hoisted(() => ({ current: [] as ProviderInfo[] }));
const identity = vi.hoisted(() => ({ current: null as { id: string } | null }));

vi.mock("@norish/auth/providers", () => ({ getAvailableProviders: async () => providers.current }));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isRegistrationEnabled: async () => false,
}));
vi.mock("@/lib/request-profile", () => ({
  readRequestProfile: async () => ({ identity: identity.current }),
}));
vi.mock("@/features/auth/login-screen", () => ({ LoginScreen: () => null }));

const { default: LoginPage } = await import("@/app/(auth)/login/page");

const GITHUB: ProviderInfo = { id: "github", name: "GitHub", icon: "github", type: "oauth" };
const GOOGLE: ProviderInfo = { id: "google", name: "Google", icon: "google", type: "oauth" };
const PASSWORD: ProviderInfo = {
  id: "credential",
  name: "Email",
  icon: "mail",
  type: "credential",
};

async function screenProps(
  offered: ProviderInfo[],
  search: Record<string, string> = {},
  signedIn = false
) {
  providers.current = offered;
  identity.current = signedIn ? { id: "reader" } : null;
  const page = (await LoginPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(search),
  })) as ReactElement<{ autoSignInProvider?: ProviderInfo; sessionEnded?: boolean }>;

  return page.props;
}

async function autoSignInProvider(offered: ProviderInfo[], search: Record<string, string> = {}) {
  return (await screenProps(offered, search)).autoSignInProvider;
}

describe("login page auto sign-in", () => {
  it("signs in with the one OAuth provider when there are no credentials", async () => {
    expect(await autoSignInProvider([GITHUB])).toBe(GITHUB);
  });

  it("stays on the page right after signing out", async () => {
    expect(await autoSignInProvider([GITHUB], { logout: "true" })).toBeUndefined();
  });

  it("lets the reader choose between several providers", async () => {
    expect(await autoSignInProvider([GITHUB, GOOGLE])).toBeUndefined();
    expect(await autoSignInProvider([GITHUB, PASSWORD])).toBeUndefined();
  });

  it("shows the form when credentials are the only way in", async () => {
    expect(await autoSignInProvider([PASSWORD])).toBeUndefined();
  });
});

describe("login page after a session ended", () => {
  it("tells the screen when a signed-in page sent the reader here", async () => {
    expect((await screenProps([PASSWORD], { callbackUrl: "/groceries" })).sessionEnded).toBe(true);
  });

  it("does not while the request still carries a session", async () => {
    const back = { callbackUrl: "/groceries" };

    expect((await screenProps([PASSWORD], back, true)).sessionEnded).toBe(false);
  });

  it("does not after a sign-out, or on a plain visit", async () => {
    const signedOut = { callbackUrl: "/groceries", logout: "true" };

    expect((await screenProps([PASSWORD], signedOut)).sessionEnded).toBe(false);
    expect((await screenProps([PASSWORD])).sessionEnded).toBe(false);
  });
});
