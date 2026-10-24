import type { BetterAuthOptions, Where } from "better-auth";
import type { DBAdapter } from "better-auth/adapters";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth } from "better-auth/plugins";

import type { ApiKeyAuthService } from "@norish/shared/contracts/dto/auth";
import { AUTH_SECRET, encrypt, hmacIndex, safeDecrypt } from "@norish/config/crypto";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { db } from "@norish/db/drizzle";
import { setApiKeyAuthService } from "@norish/db/repositories/api-keys";
import { setConfig } from "@norish/db/repositories/server-config";
import { countUsers } from "@norish/db/repositories/users";
import * as schema from "@norish/db/schema/auth";
import { isRegistrationEnabled } from "@norish/shared-server/config/server-config-loader";
import { authLogger } from "@norish/shared-server/logger";
import { keepsOfferedSignInMethod, LAST_SIGN_IN_METHOD } from "@norish/shared/contracts/dto/auth";
import { addBasePath } from "@norish/shared/lib/base-path";

import {
  getPendingOIDCProfile,
  mergeOIDCTokenClaims,
  processClaimsForUser,
  storeOIDCProfile,
} from "./claim-processor";
import { API_KEY_HEADERS } from "./credentials";
import {
  getCachedGitHubProvider,
  getCachedGoogleProvider,
  getCachedOIDCClaimConfig,
  getCachedOIDCProvider,
  getCachedPasswordAuthEnabled,
} from "./provider-cache";
import { getAvailableProviders } from "./providers";
import { valkeySecondaryStorage } from "./secondary-storage";

/**
 * Creates a wrapped adapter factory that intercepts user email lookups
 * and converts them to use emailHmac for encrypted email lookup.
 *
 * Better Auth queries users with WHERE email = 'plain@email.com',
 * but we store encrypted emails. This wrapper converts email lookups
 * to use the deterministic emailHmac field instead.
 *
 * The user it finds by email, or joined onto an account (an OAuth sign-in),
 * comes back decrypted: Better Auth compares the provider's verified email
 * with it to mark the user verified, and seeds the session with it.
 */
function createEncryptedEmailAdapter<T extends BetterAuthOptions>(
  baseAdapterFactory: (options: T) => DBAdapter<T>
): (options: T) => DBAdapter<T> {
  return (options: T) => {
    const baseAdapter = baseAdapterFactory(options);

    return {
      ...baseAdapter,
      findOne: async (params) => {
        if (params.model === "user" && params.where) {
          const emailWhere = params.where.find(
            (w: Where) => w.field === "email" && w.value && typeof w.value === "string"
          );

          if (emailWhere) {
            // Lookup by email - convert to emailHmac
            const emailHmacValue = hmacIndex(emailWhere.value as string);
            const modifiedWhere = params.where.map((w: Where) =>
              w.field === "email" ? { ...w, field: "emailHmac", value: emailHmacValue } : w
            );

            return decryptUser(
              await baseAdapter.findOne({
                ...params,
                where: modifiedWhere,
              })
            );
          }
        }

        const result = await baseAdapter.findOne(params);

        return params.model === "account" ? decryptJoinedUser(result) : result;
      },
      // Better Auth finds the owner of an OAuth account with a findMany joined
      // onto the user.
      findMany: async <R>(params: Parameters<DBAdapter<T>["findMany"]>[0]) => {
        const results = await baseAdapter.findMany<R>(params);

        return params.model === "account" ? results.map((row) => decryptJoinedUser(row)) : results;
      },
    };
  };
}

function decryptJoinedUser<T>(row: T): T {
  if (row && typeof row === "object" && "user" in row) {
    return { ...row, user: decryptUser(row.user) };
  }

  return row;
}

// Helper to decrypt user object fields
function decryptUser(user: any): any {
  if (!user) return user;

  return {
    ...user,
    email: safeDecrypt(user.email),
    name: safeDecrypt(user.name),
    image: safeDecrypt(user.image),
  };
}

function oidcDiscoveryUrl(oidc: { wellknown?: string; issuer: string }): string {
  return oidc.wellknown || new URL(".well-known/openid-configuration", oidc.issuer).toString();
}

/**
 * An add asks the provider which account rather than reusing its session: its account picker
 * where it lists one, a fresh sign-in otherwise (Authentik and Pocket ID before 2.7 list none).
 */
async function addPrompt(provider: string): Promise<string | undefined> {
  if (provider === "google" || provider === "github") return "select_account";

  const oidc = getCachedOIDCProvider();

  if (provider !== "oidc" || !oidc) return undefined;

  const discovery = await fetch(oidcDiscoveryUrl(oidc), { signal: AbortSignal.timeout(5000) })
    .then((response) => response.json() as Promise<{ prompt_values_supported?: unknown }>)
    .catch(() => null);
  const supported = discovery?.prompt_values_supported;

  return Array.isArray(supported) && supported.includes("select_account")
    ? "select_account"
    : "login";
}

// For any client: an add picks its account, and removing never leaves no method the server offers.
const guardSignInMethods = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/link-social") {
    const prompt = await addPrompt(ctx.body?.provider);

    return prompt
      ? {
          context: {
            body: { ...ctx.body, additionalParams: { ...ctx.body.additionalParams, prompt } },
          },
        }
      : undefined;
  }

  if (ctx.path !== "/unlink-account") return;

  const session = await getSessionFromCtx(ctx);

  // The endpoint refuses a request without a session itself.
  if (!session) return;

  const accounts = await ctx.context.internalAdapter.findAccounts(session.user.id);
  const offered = new Set((await getAvailableProviders()).map((provider) => provider.id));

  if (!keepsOfferedSignInMethod(accounts, ctx.body?.accountId, offered)) {
    throw new APIError("BAD_REQUEST", {
      code: LAST_SIGN_IN_METHOD,
      message: "This is the last way to sign in",
    });
  }
});

// Build social providers configuration from cached DB values
function buildSocialProviders() {
  const providers: Record<string, any> = {};

  const githubProvider = getCachedGitHubProvider();

  if (githubProvider?.clientId && githubProvider?.clientSecret) {
    providers.github = {
      clientId: githubProvider.clientId,
      clientSecret: githubProvider.clientSecret,
    };
  }

  const googleProvider = getCachedGoogleProvider();

  if (googleProvider?.clientId && googleProvider?.clientSecret) {
    providers.google = {
      clientId: googleProvider.clientId,
      clientSecret: googleProvider.clientSecret,
    };
  }

  return providers;
}

function isOIDCConfigured(): boolean {
  const oidcProvider = getCachedOIDCProvider();

  return Boolean(oidcProvider?.clientId && oidcProvider.clientSecret && oidcProvider.issuer);
}

function buildOIDCProviders() {
  const providers: any[] = [];

  const oidcProvider = getCachedOIDCProvider();

  if (oidcProvider && isOIDCConfigured()) {
    // Build scopes: base scopes + any additional configured scopes
    const baseScopes = ["openid", "profile", "email"];
    const additionalScopes = oidcProvider.claimConfig?.scopes ?? [];
    const allScopes = [...new Set([...baseScopes, ...additionalScopes])];

    providers.push({
      providerId: "oidc",
      discoveryUrl: oidcDiscoveryUrl(oidcProvider),
      clientId: oidcProvider.clientId,
      clientSecret: oidcProvider.clientSecret,
      scopes: allScopes,
      pkce: true,
      // Signing out of Norish leaves the identity provider's session alone.
      disableProviderLogout: true,
      // Store full profile for claim processing after session creation
      // Merges claims from ID token and userinfo endpoint (ID token takes precedence for groups)
      getUserInfo: async (tokens: { accessToken: string; idToken?: string }) => {
        const result = await mergeOIDCTokenClaims(tokens, oidcDiscoveryUrl(oidcProvider));

        if (!result) {
          return null;
        }

        const { profile, groupsSource } = result;
        const sub = profile.sub as string;

        // Store the merged profile in Valkey for claim processing
        await storeOIDCProfile(sub, profile);
        authLogger.debug(
          { sub, hasGroups: "groups" in profile, groupsSource },
          "Stored merged OIDC profile in Valkey for claim processing"
        );

        return {
          id: sub,
          // Better Auth keys an OIDC account on the subject.
          sub,
          email: (profile.email as string) || undefined,
          name: (profile.name as string) || (profile.preferred_username as string) || undefined,
          image: (profile.picture as string) || undefined,
          emailVerified: (profile.email_verified as boolean) ?? false,
        };
      },
    });
  }

  return providers;
}

// Build emailAndPassword configuration from cached DB value
function buildEmailAndPasswordConfig() {
  const passwordEnabled = getCachedPasswordAuthEnabled();

  if (!passwordEnabled) {
    return undefined;
  }

  return {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  };
}

function createBetterAuth() {
  const emailAndPasswordConfig = buildEmailAndPasswordConfig();

  // Create base drizzle adapter factory
  const baseAdapterFactory = drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verification,
      apikey: schema.apiKeys,
    },
  });

  // Wrap adapter factory to handle encrypted email lookups
  const encryptedEmailAdapter = createEncryptedEmailAdapter(baseAdapterFactory);

  return betterAuth({
    database: encryptedEmailAdapter,
    secret: AUTH_SECRET,
    // A path in `baseURL` would replace `basePath`, so the prefix rides on `basePath` alone.
    baseURL: new URL(SERVER_CONFIG.AUTH_URL).origin,
    basePath: addBasePath("/api/auth"),
    trustedOrigins: [
      SERVER_CONFIG.AUTH_URL,
      ...SERVER_CONFIG.TRUSTED_ORIGINS,
      ...(process.env.NODE_ENV === "development"
        ? [
            /* eslint-disable sonarjs/no-clear-text-protocols -- development only: a phone on the LAN reaches the dev server over plain http */
            "http://*/*",
            "http://10.0.0.*:*/*",
            "http://192.168.*.*:*/*",
            "http://172.*.*.*:*/*",
            "http://localhost:*/*",
            /* eslint-enable sonarjs/no-clear-text-protocols */
          ]
        : []),
    ],
    secondaryStorage: valkeySecondaryStorage,
    advanced: {
      ipAddress: { trustedProxies: SERVER_CONFIG.TRUSTED_PROXIES },
    },
    // Rate limiting configuration. Values come from the environment so a test
    // harness can lift the ceiling; the defaults are the production ones.
    rateLimit: {
      enabled: SERVER_CONFIG.AUTH_RATE_LIMIT_ENABLED,
      window: SERVER_CONFIG.AUTH_RATE_LIMIT_WINDOW, // seconds
      max: SERVER_CONFIG.AUTH_RATE_LIMIT_MAX, // requests per window
      storage: "secondary-storage",
    },
    // Email and password authentication (conditionally enabled)
    ...(emailAndPasswordConfig && { emailAndPassword: emailAndPasswordConfig }),
    user: {
      modelName: "user",
      additionalFields: {
        emailHmac: {
          type: "string",
          required: false,
          input: false,
        },
        isServerOwner: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
        isServerAdmin: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },

    session: {
      modelName: "session",
    },

    account: {
      modelName: "account",
      // Using BetterAuth native column names - no field mapping needed
      ...(process.env.NODE_ENV === "development" && {
        skipStateCookieCheck: true,
      }),
      accountLinking: {
        enabled: true,
        // Signing in never links, even on a matching email: that is how accounts are taken
        // over. A signed-in add proves both sides, so it needs no verified or matching email.
        disableImplicitLinking: true,
        trustedProviders: ["oidc", "google", "github"],
        allowDifferentEmails: true,
      },
    },
    socialProviders: buildSocialProviders(),
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            // Check registration status
            const registrationEnabled = await isRegistrationEnabled();
            const userCount = await countUsers();
            const isFirstUser = userCount === 0;

            if (!registrationEnabled && !isFirstUser) {
              // The OAuth callback sends an error to the auth-error page only
              // when it carries a code; without one the browser gets bare JSON.
              throw new APIError("FORBIDDEN", {
                code: "REGISTRATION_IS_CURRENTLY_DISABLED",
                message: "Registration is currently disabled",
              });
            }

            // Encrypt the PII values - BetterAuth writes these directly to email, name, image columns
            const encryptedEmail = user.email ? encrypt(user.email) : user.email;
            const encryptedName = user.name ? encrypt(user.name) : user.name;
            const encryptedImage = user.image ? encrypt(user.image) : user.image;

            const result = {
              data: {
                ...user,
                email: encryptedEmail,
                name: encryptedName,
                image: encryptedImage,
                emailHmac: user.email ? hmacIndex(user.email) : undefined,
                // Set owner/admin for first user
                isServerOwner: isFirstUser,
                isServerAdmin: isFirstUser,
              },
            };

            return result;
          },
          after: async (user) => {
            // If this was the first user, disable registration
            const userCount = await countUsers();

            if (userCount === 1) {
              authLogger.info(
                { email: user.email },
                "First user registered, set as server owner/admin"
              );
              authLogger.info("Disabling registration after first user");
              await setConfig(ServerConfigKeys.REGISTRATION_ENABLED, false, user.id, false);
            }
          },
        },
        update: {
          before: async (user) => {
            const updates: any = { ...user };

            if (user.email !== undefined) {
              updates.email = user.email ? encrypt(user.email) : user.email;
              updates.emailHmac = user.email ? hmacIndex(user.email) : undefined;
            }
            if (user.name !== undefined) {
              updates.name = user.name ? encrypt(user.name) : user.name;
            }
            if (user.image !== undefined) {
              updates.image = user.image ? encrypt(user.image) : user.image;
            }

            return { data: updates };
          },
        },
      },
      account: {
        create: {
          before: async (account, ctx) => {
            // One identity per provider, also when two adds started together both finish.
            const accounts = await ctx?.context.internalAdapter.findAccounts(account.userId);

            if (accounts?.some((existing) => existing.providerId === account.providerId)) {
              return false;
            }

            return { data: account };
          },
          after: async (account) => {
            // Process OIDC claims after account is created/updated
            // This runs on every OAuth login (account is updated with new tokens)
            if (account.providerId === "oidc" && account.accountId) {
              const profile = await getPendingOIDCProfile(account.accountId);

              if (profile) {
                authLogger.debug(
                  { userId: account.userId, accountId: account.accountId },
                  "Processing OIDC claims from account hook"
                );
                const claimConfig = getCachedOIDCClaimConfig();

                try {
                  await processClaimsForUser(account.userId, profile, claimConfig ?? undefined);
                } catch (error) {
                  authLogger.error(
                    { error, userId: account.userId },
                    "Failed to process OIDC claims"
                  );
                }
              }
            }
          },
        },
        update: {
          after: async (account) => {
            // Also process on account update (subsequent logins update tokens)
            if (account.providerId === "oidc" && account.accountId) {
              const profile = await getPendingOIDCProfile(account.accountId);

              if (profile) {
                authLogger.debug(
                  { userId: account.userId, accountId: account.accountId },
                  "Processing OIDC claims from account update hook"
                );
                const claimConfig = getCachedOIDCClaimConfig();

                try {
                  await processClaimsForUser(account.userId, profile, claimConfig ?? undefined);
                } catch (error) {
                  authLogger.error(
                    { error, userId: account.userId },
                    "Failed to process OIDC claims"
                  );
                }
              }
            }
          },
        },
      },
    },
    plugins: [
      genericOAuth({
        config: buildOIDCProviders(),
      }),

      apiKey({
        enableSessionForAPIKeys: true,
        rateLimit: {
          enabled: true,
          timeWindow: 1000 * 60 * 60 * 1,
          maxRequests: 500,
        },
        apiKeyHeaders: [...API_KEY_HEADERS],
      }),

      nextCookies(),
    ],

    hooks: {
      before: guardSignInMethods,
      after: createAuthMiddleware(async (ctx) => {
        const returned = ctx.context.returned;

        if (!returned || typeof returned !== "object") return;

        if ("user" in returned && returned.user) {
          (returned as any).user = decryptUser(returned.user);
        }

        if (
          "session" in returned &&
          returned.session &&
          typeof returned.session === "object" &&
          "user" in returned.session
        ) {
          (returned.session as any).user = decryptUser((returned.session as any).user);
        }
      }),
    },
  });
}

// The configured instance's own type, so plugin API methods are included.
type AuthInstance = ReturnType<typeof createBetterAuth>;

/*
 * Better Auth reads OIDC discovery once, while an instance is built, and leaves
 * the provider out when it cannot be reached. Until an instance has it, a
 * replacement is built in the background, at most every 30 seconds, and takes
 * over once it has the provider. Requests keep the instance in use meanwhile,
 * so a provider that never answers cannot hold them up.
 */
const OIDC_DISCOVERY_RETRY_MS = 30_000;

// Lazy-initialized auth instance
let _auth: AuthInstance | null = null;
// From this time on, the next access builds a replacement in the background.
let _retryAt: number | null = null;

async function hasOIDCProvider(instance: AuthInstance): Promise<boolean> {
  const ctx = await instance.$context.catch(() => null);

  if (ctx?.socialProviders.some((provider) => provider.id === "oidc")) {
    return true;
  }

  authLogger.warn(
    { retryInMs: OIDC_DISCOVERY_RETRY_MS },
    "OIDC provider could not be reached, sign-in with it is off until a retry succeeds"
  );
  _retryAt = Date.now() + OIDC_DISCOVERY_RETRY_MS;

  return false;
}

function currentAuth(): AuthInstance {
  if (!_auth) {
    _auth = createBetterAuth();

    if (isOIDCConfigured()) void hasOIDCProvider(_auth);
  } else if (_retryAt !== null && Date.now() >= _retryAt) {
    const replacement = createBetterAuth();

    _retryAt = null;
    void hasOIDCProvider(replacement).then((ready) => {
      if (ready) _auth = replacement;
    });
  }

  return _auth;
}

/**
 * Get the auth instance (lazy-initialized on first access)
 * This ensures the provider cache is populated before BetterAuth is created
 */
export const auth = new Proxy({} as AuthInstance, {
  get(_target, prop) {
    const value = Reflect.get(currentAuth(), prop);

    // A caller may keep a method it read once (the auth route exports
    // `auth.handler`), so the method calls whichever instance is current then.
    return typeof value === "function"
      ? (...args: unknown[]) => Reflect.get(currentAuth(), prop)(...args)
      : value;
  },
});

const apiKeyAuthService: ApiKeyAuthService = {
  createApiKey(input) {
    return auth.api.createApiKey(input);
  },
  verifyApiKey(input) {
    return auth.api.verifyApiKey(input);
  },
};

setApiKeyAuthService(apiKeyAuthService);

// Export type for client inference
export type Auth = AuthInstance;
