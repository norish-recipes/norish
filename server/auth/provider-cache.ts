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
  isInitialized: boolean;
}

declare global {
  var norish_authProviderCache: AuthProviderCache | undefined;
  var norish_resetAuthInstance: (() => void) | undefined;
}

function ensureCache(): AuthProviderCache {
  if (!globalThis.norish_authProviderCache) {
    globalThis.norish_authProviderCache = {
      github: null,
      google: null,
      oidc: null,
      passwordEnabled: false,
      isInitialized: false,
    };
  }

  return globalThis.norish_authProviderCache;
}

export function setAuthProviderCache(
  providers: Omit<AuthProviderCache, "isInitialized">
): void {
  const cache = ensureCache();

  Object.assign(cache, providers, { isInitialized: true });

  // Reset auth instance when cache is updated so it picks up new config
  if (globalThis.norish_resetAuthInstance) {
    globalThis.norish_resetAuthInstance();
  }
}

const getProvider =
  <K extends keyof Omit<AuthProviderCache, "isInitialized">>(key: K) =>
  (): AuthProviderCache[K] => {
    const cache = ensureCache();

    // Warn if cache hasn't been initialized yet (shouldn't happen in production)
    if (!cache.isInitialized && process.env.NODE_ENV === "development") {
      console.warn(
        `[Auth] Provider cache accessed before initialization. Key: ${String(key)}. This may cause authentication issues.`
      );
    }

    return cache[key];
  };

export const getCachedGitHubProvider = getProvider("github");
export const getCachedGoogleProvider = getProvider("google");
export const getCachedOIDCProvider = getProvider("oidc");
export const getCachedPasswordAuthEnabled = (): boolean => {
  const cache = ensureCache();

  // Warn if cache hasn't been initialized yet
  if (!cache.isInitialized && process.env.NODE_ENV === "development") {
    console.warn(
      "[Auth] Password auth cache accessed before initialization. Defaulting to false. This may cause login issues."
    );
  }

  return cache.passwordEnabled;
};
