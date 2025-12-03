import { LoginClient } from "./components/login-client";

import { getAvailableProviders } from "@/server/auth/providers";
import { isRegistrationEnabled } from "@/config/server-config-loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; logout?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [providers, registrationEnabled] = await Promise.all([
    getAvailableProviders(),
    isRegistrationEnabled(),
  ]);

  const { callbackUrl = "/", logout } = await searchParams;
  const justLoggedOut = logout === "true";

  // Only auto-redirect for single OAuth provider
  const oauthProviders = providers.filter((p) => p.type === "oauth");
  const hasCredential = providers.some((p) => p.type === "credential");
  const shouldAutoRedirect = oauthProviders.length === 1 && !hasCredential && !justLoggedOut;

  return (
    <LoginClient
      autoRedirect={shouldAutoRedirect}
      callbackUrl={callbackUrl}
      providers={providers}
      registrationEnabled={registrationEnabled}
    />
  );
}
