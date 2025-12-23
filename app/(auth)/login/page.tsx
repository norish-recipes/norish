import { LoginClient } from "./components/login-client";

import { getAvailableProviders, isLdapEnabled } from "@/server/auth/providers";
import { isRegistrationEnabled } from "@/config/server-config-loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; logout?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [providers, registrationEnabledConfig] = await Promise.all([
    getAvailableProviders(),
    isRegistrationEnabled(),
  ]);

  // Disable registration if LDAP is enabled (users must use LDAP accounts)
  const registrationEnabled = isLdapEnabled() ? false : registrationEnabledConfig;

  const { callbackUrl = "/", logout } = await searchParams;
  const justLoggedOut = logout === "true";

  // Only auto-redirect for single OAuth provider (if no credential or LDAP providers)
  const oauthProviders = providers.filter((p) => p.type === "oauth");
  const hasCredential = providers.some((p) => p.type === "credential");
  const hasLdap = providers.some((p) => p.type === "ldap");
  const shouldAutoRedirect =
    oauthProviders.length === 1 && !hasCredential && !hasLdap && !justLoggedOut;

  return (
    <LoginClient
      autoRedirect={shouldAutoRedirect}
      callbackUrl={callbackUrl}
      providers={providers}
      registrationEnabled={registrationEnabled}
    />
  );
}
