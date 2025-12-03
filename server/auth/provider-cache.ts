import type {
  AuthProviderOIDC,
  AuthProviderGitHub,
  AuthProviderGoogle,
} from "@/server/db/zodSchemas/server-config";

interface AuthProviderCache {
  github: AuthProviderGitHub | null;
  google: AuthProviderGoogle | null;
  oidc: AuthProviderOIDC | null;
  passwordEnabled: boolean;
}

declare global {
  var norish_authProviderCache: AuthProviderCache | undefined;
}

function ensureCache(): AuthProviderCache {
  if (!globalThis.norish_authProviderCache) {
    globalThis.norish_authProviderCache = {
      github: null,
      google: null,
      oidc: null,
      passwordEnabled: false,
    };
  }

  return globalThis.norish_authProviderCache;
}

export function setAuthProviderCache(providers: AuthProviderCache): void {
  Object.assign(ensureCache(), providers);
}

const getProvider =
  <K extends keyof AuthProviderCache>(key: K) =>
  (): AuthProviderCache[K] =>
    ensureCache()[key];

export const getCachedGitHubProvider = getProvider("github");
export const getCachedGoogleProvider = getProvider("google");
export const getCachedOIDCProvider = getProvider("oidc");
export const getCachedPasswordAuthEnabled = (): boolean => ensureCache().passwordEnabled;
