import { getAvailableProviders } from "@norish/auth/providers";
import { isRegistrationEnabled } from "@norish/shared-server/config/server-config-loader";
import { APP_ROOT } from "@norish/shared/lib/base-path";

import { LoginClient } from "./components/login-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [providers, registrationEnabled] = await Promise.all([
    getAvailableProviders(),
    isRegistrationEnabled(),
  ]);

  const { callbackUrl, logout } = await searchParams;
  const justLoggedOut = logout === "true";

  // Only auto-redirect for single OAuth provider
  const oauthProviders = providers.filter((p) => p.type === "oauth");
  const hasCredential = providers.some((p) => p.type === "credential");
  const shouldAutoRedirect = oauthProviders.length === 1 && !hasCredential && !justLoggedOut;

  return (
    <LoginClient
      autoRedirect={shouldAutoRedirect}
      // A repeated parameter arrives as a list; only a single one is a destination.
      callbackUrl={typeof callbackUrl === "string" ? callbackUrl : APP_ROOT}
      providers={providers}
      registrationEnabled={registrationEnabled}
    />
  );
}
