import { LoginScreen } from "@/features/auth/login-screen";

import { getAvailableProviders } from "@norish/auth/providers";
import { isRegistrationEnabled } from "@norish/shared-server/config/server-config-loader";
import { APP_ROOT } from "@norish/shared/lib/base-path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [providers, registrationEnabled] = await Promise.all([
    getAvailableProviders(),
    isRegistrationEnabled(),
  ]);

  const { callbackUrl, logout } = await searchParams;
  const justLoggedOut = logout === "true";

  // One OAuth provider and nothing else signs straight in, unless the reader just signed out.
  const [onlyProvider] = providers;
  const autoSignInProvider =
    providers.length === 1 && onlyProvider?.type === "oauth" && !justLoggedOut
      ? onlyProvider
      : undefined;

  return (
    <LoginScreen
      autoSignInProvider={autoSignInProvider}
      // A repeated parameter arrives as a list; only a single one is a destination.
      callbackUrl={typeof callbackUrl === "string" ? callbackUrl : APP_ROOT}
      providers={providers}
      registrationEnabled={registrationEnabled}
      // A destination without a sign-out is a signed-in page the session no longer reaches.
      sessionEnded={typeof callbackUrl === "string" && !justLoggedOut}
    />
  );
}
