/** An ended session's offline data is forgotten before the auto sign-in leaves for the provider. */
import { LoginScreen } from "@/features/auth/login-screen";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderInfo } from "@norish/shared/contracts";

const { clearForSignOut, signInSocial } = vi.hoisted(() => ({
  clearForSignOut: vi.fn(),
  signInSocial: vi.fn(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/offline/engine", () => ({ offlineEngine: { clearForSignOut } }));
vi.mock("@norish/shared/lib/auth/client", () => ({ signIn: { social: signInSocial } }));
vi.mock("@/components/brand/brand-logo", () => ({ BrandLogo: () => null }));
vi.mock("@/components/auth/provider-icon", () => ({ ProviderIcon: () => null }));

const GITHUB: ProviderInfo = { id: "github", name: "GitHub", icon: "github", type: "oauth" };

function deferred() {
  let settle = { resolve: () => {}, reject: (_error: unknown) => {} };
  const promise = new Promise<void>((resolve, reject) => {
    settle = { resolve, reject };
  });

  return { promise, ...settle };
}

function renderAutoSignIn(sessionEnded: boolean) {
  render(
    <LoginScreen autoSignInProvider={GITHUB} providers={[GITHUB]} sessionEnded={sessionEnded} />
  );
}

beforeEach(() => {
  clearForSignOut.mockReset();
  signInSocial.mockReset();
});

describe("LoginScreen after a session ended", () => {
  it("signs in only once the clear has finished", async () => {
    const clear = deferred();

    clearForSignOut.mockReturnValue(clear.promise);
    renderAutoSignIn(true);
    await new Promise((settled) => setTimeout(settled, 0));

    expect(clearForSignOut).toHaveBeenCalledWith({ discardQueue: false });
    expect(signInSocial).not.toHaveBeenCalled();

    clear.resolve();
    await waitFor(() => expect(signInSocial).toHaveBeenCalledTimes(1));
  });

  it("still signs in when the clear fails", async () => {
    const clear = deferred();

    clearForSignOut.mockReturnValue(clear.promise);
    renderAutoSignIn(true);
    clear.reject(new Error("storage gone"));

    await waitFor(() => expect(signInSocial).toHaveBeenCalledTimes(1));
  });

  it("signs straight in when no session ended", async () => {
    renderAutoSignIn(false);

    await waitFor(() => expect(signInSocial).toHaveBeenCalledTimes(1));
    expect(clearForSignOut).not.toHaveBeenCalled();
  });
});
