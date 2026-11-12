// @vitest-environment node
/** The sign-in route signs straight in only when one OAuth provider is all there is. */
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ProviderInfo } from "@norish/shared/contracts";

const providers = vi.hoisted(() => ({ current: [] as ProviderInfo[] }));

vi.mock("@norish/auth/providers", () => ({ getAvailableProviders: async () => providers.current }));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isRegistrationEnabled: async () => false,
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

async function autoSignInProvider(offered: ProviderInfo[], search: Record<string, string> = {}) {
  providers.current = offered;
  const page = (await LoginPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(search),
  })) as ReactElement<{ autoSignInProvider?: ProviderInfo }>;

  return page.props.autoSignInProvider;
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
