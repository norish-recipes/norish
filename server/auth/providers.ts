import type { ProviderInfo } from "@/types";

import { getConfig } from "@/server/db/repositories/server-config";
import {
  ServerConfigKeys,
  type AuthProviderOIDC,
  type AuthProviderGitHub,
  type AuthProviderGoogle,
} from "@/server/db/zodSchemas/server-config";
import { isLdapEnabled } from "@/server/auth/ldap-plugin";

export async function getAvailableProviders(): Promise<ProviderInfo[]> {
  const providers: ProviderInfo[] = [];

  // Check password auth (disabled when LDAP is enabled)
  if (!isLdapEnabled()) {
    const passwordEnabled = await getConfig<boolean>(ServerConfigKeys.PASSWORD_AUTH_ENABLED);

    if (passwordEnabled) {
      providers.push({
        id: "credential",
        name: "Email",
        icon: "mdi:email-outline",
        type: "credential",
      });
    }
  }

  // Check GitHub provider
  const github = await getConfig<AuthProviderGitHub>(ServerConfigKeys.AUTH_PROVIDER_GITHUB, true);

  if (github?.clientId) {
    providers.push({
      id: "github",
      name: "GitHub",
      icon: "mdi:github",
      type: "oauth",
    });
  }

  // Check Google provider
  const google = await getConfig<AuthProviderGoogle>(ServerConfigKeys.AUTH_PROVIDER_GOOGLE, true);

  if (google?.clientId) {
    providers.push({
      id: "google",
      name: "Google",
      icon: "flat-color-icons:google",
      type: "oauth",
    });
  }

  // Check OIDC provider
  const oidc = await getConfig<AuthProviderOIDC>(ServerConfigKeys.AUTH_PROVIDER_OIDC, true);

  if (oidc?.clientId && oidc?.issuer) {
    providers.push({
      id: "oidc",
      name: oidc.name || "SSO",
      icon: "mdi:shield-account-outline",
      type: "oauth",
    });
  }

  // Check LDAP provider (configured via env vars)
  if (isLdapEnabled()) {
    providers.push({
      id: "ldap",
      name: "LDAP",
      icon: "mdi:folder-network-outline",
      type: "ldap",
    });
  }

  return providers;
}

export async function isPasswordAuthEnabled(): Promise<boolean> {
  const passwordEnabled = await getConfig<boolean>(ServerConfigKeys.PASSWORD_AUTH_ENABLED);

  return passwordEnabled ?? false;
}

// Re-export from ldap-plugin for convenience
export { isLdapEnabled } from "@/server/auth/ldap-plugin";

export async function getConfiguredProviders(): Promise<Record<string, boolean>> {
  const [github, google, oidc, passwordEnabled] = await Promise.all([
    getConfig<AuthProviderGitHub>(ServerConfigKeys.AUTH_PROVIDER_GITHUB, true),
    getConfig<AuthProviderGoogle>(ServerConfigKeys.AUTH_PROVIDER_GOOGLE, true),
    getConfig<AuthProviderOIDC>(ServerConfigKeys.AUTH_PROVIDER_OIDC, true),
    getConfig<boolean>(ServerConfigKeys.PASSWORD_AUTH_ENABLED),
  ]);

  return {
    github: !!github?.clientId,
    google: !!google?.clientId,
    oidc: !!(oidc?.clientId && oidc?.issuer),
    password: !!passwordEnabled,
  };
}
