import type {
  AuthProviderGitHub,
  AuthProviderGoogle,
  AuthProviderOIDC,
} from "@norish/config/zod/server-config";
import type { ProviderInfo } from "@norish/shared/contracts";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { getConfig } from "@norish/db/repositories/server-config";
import { SIGN_IN_METHODS } from "@norish/shared/contracts/dto/auth";

export async function getAvailableProviders(): Promise<ProviderInfo[]> {
  const providers: ProviderInfo[] = [];

  // Check password auth
  const passwordEnabled = await getConfig<boolean>(ServerConfigKeys.PASSWORD_AUTH_ENABLED);

  if (passwordEnabled) {
    providers.push(SIGN_IN_METHODS.credential);
  }

  // Check GitHub provider
  const github = await getConfig<AuthProviderGitHub>(ServerConfigKeys.AUTH_PROVIDER_GITHUB, true);

  if (github?.clientId) {
    providers.push(SIGN_IN_METHODS.github);
  }

  // Check Google provider
  const google = await getConfig<AuthProviderGoogle>(ServerConfigKeys.AUTH_PROVIDER_GOOGLE, true);

  if (google?.clientId) {
    providers.push(SIGN_IN_METHODS.google);
  }

  // Check OIDC provider
  const oidc = await getConfig<AuthProviderOIDC>(ServerConfigKeys.AUTH_PROVIDER_OIDC, true);

  if (oidc?.clientId && oidc?.issuer) {
    providers.push({ ...SIGN_IN_METHODS.oidc, name: oidc.name || SIGN_IN_METHODS.oidc.name });
  }

  return providers;
}

export async function isPasswordAuthEnabled(): Promise<boolean> {
  const passwordEnabled = await getConfig<boolean>(ServerConfigKeys.PASSWORD_AUTH_ENABLED);

  return passwordEnabled ?? false;
}

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
