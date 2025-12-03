import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { apiKey, genericOAuth } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";

import {
  getCachedGitHubProvider,
  getCachedGoogleProvider,
  getCachedOIDCProvider,
  getCachedPasswordAuthEnabled,
} from "./provider-cache";

import { db } from "@/server/db/drizzle";
import { SERVER_CONFIG } from "@/config/env-config-server";
import { AUTH_SECRET, encrypt, hmacIndex, safeDecrypt } from "@/server/auth/crypto";
import { isRegistrationEnabled } from "@/config/server-config-loader";
import { setConfig } from "@/server/db/repositories/server-config";
import { countUsers } from "@/server/db/repositories/users";
import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";
import * as schema from "@/server/db/schema/auth";
import { authLogger } from "@/server/logger";

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

function buildOIDCProviders() {
  const providers: any[] = [];

  const oidcProvider = getCachedOIDCProvider();

  if (oidcProvider?.clientId && oidcProvider?.clientSecret && oidcProvider?.issuer) {
    providers.push({
      providerId: "oidc",
      discoveryUrl:
        oidcProvider.wellknown ||
        new URL(".well-known/openid-configuration", oidcProvider.issuer).toString(),
      clientId: oidcProvider.clientId,
      clientSecret: oidcProvider.clientSecret,
      scopes: ["openid", "profile", "email"],
      pkce: true,
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

// Lazy-initialized auth instance
let _auth: ReturnType<typeof betterAuth> | null = null;

function createAuth() {
  const emailAndPasswordConfig = buildEmailAndPasswordConfig();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verification,
        apikey: schema.apiKeys,
      },
    }),
    secret: AUTH_SECRET,
    baseURL: SERVER_CONFIG.AUTH_URL,
    trustedOrigins: [
      SERVER_CONFIG.AUTH_URL,
      ...(process.env.NODE_ENV === "development"
        ? [
            "http://*/*",
            "http://10.0.0.*:*/*",
            "http://192.168.*.*:*/*",
            "http://172.*.*.*:*/*",
            "http://localhost:*/*",
          ]
        : []),
    ],
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
              throw new APIError("FORBIDDEN", {
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
          before: async (account) => {
            return { data: account };
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
        apiKeyHeaders: ["x-api-key"],
      }),

      nextCookies(),
    ],

    hooks: {
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

// Type for the auth instance including plugins
type AuthInstance = ReturnType<typeof createAuth>;

/**
 * Get the auth instance (lazy-initialized on first access)
 * This ensures the provider cache is populated before BetterAuth is created
 */
export const auth = new Proxy({} as AuthInstance, {
  get(_target, prop) {
    if (!_auth) {
      _auth = createAuth();
    }

    return (_auth as any)[prop];
  },
});

// Export type for client inference
export type Auth = AuthInstance;
