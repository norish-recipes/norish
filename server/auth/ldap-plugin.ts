import type { BetterAuthPlugin } from "better-auth";

import { createAuthEndpoint, APIError } from "better-auth/api";
import { Client } from "ldapts";
import { z } from "zod";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { authLogger } from "@/server/logger";

// Check if LDAP is configured
export function isLdapEnabled() {
  return !!(SERVER_CONFIG.LDAP_URL && SERVER_CONFIG.LDAP_BASE_DN);
}

// Authenticate user against LDAP server
async function authenticateLdap(username: string, password: string) {
  const client = new Client({
    url: SERVER_CONFIG.LDAP_URL!,
    connectTimeout: 5000,
  });

  try {
    // First, bind as admin (or anonymous) to search for the user
    if (SERVER_CONFIG.LDAP_BIND_DN && SERVER_CONFIG.LDAP_BIND_PASSWORD) {
      await client.bind(SERVER_CONFIG.LDAP_BIND_DN, SERVER_CONFIG.LDAP_BIND_PASSWORD);
    }

    // Build the search filter
    const usernameAttr = SERVER_CONFIG.LDAP_USERNAME_ATTR;
    let filter = `(${usernameAttr}=${username})`;

    if (SERVER_CONFIG.LDAP_SEARCH_FILTER) {
      // Combine with custom filter
      filter = `(&${SERVER_CONFIG.LDAP_SEARCH_FILTER}(${usernameAttr}=${username}))`;
    }

    // Search for the user
    const { searchEntries } = await client.search(SERVER_CONFIG.LDAP_BASE_DN!, {
      filter,
      scope: "sub",
      attributes: ["dn", "mail", "email", "displayName", "cn", usernameAttr],
    });

    if (searchEntries.length === 0) {
      throw new Error("User not found");
    }

    const userEntry = searchEntries[0];
    const userDn = userEntry.dn;

    // Unbind admin and rebind as user to verify password
    await client.unbind();

    const userClient = new Client({
      url: SERVER_CONFIG.LDAP_URL!,
      connectTimeout: 5000,
    });

    try {
      await userClient.bind(userDn, password);
      await userClient.unbind();
    } catch {
      throw new Error("Invalid password");
    }

    return userEntry;
  } finally {
    try {
      await client.unbind();
    } catch {
      // Ignore unbind errors
    }
  }
}

const ldapInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export function ldapPlugin(): BetterAuthPlugin {
  return {
    id: "ldap",
    endpoints: {
      signInLdap: createAuthEndpoint(
        "/sign-in/ldap",
        {
          method: "POST",
          body: ldapInputSchema,
        },
        async (ctx) => {
          const { username, password } = ctx.body;

          try {
            const ldapResult = await authenticateLdap(username, password);

            const usernameAttr = SERVER_CONFIG.LDAP_USERNAME_ATTR;
            const email =
              ldapResult.mail ||
              ldapResult.email ||
              `${ldapResult[usernameAttr] || username}@ldap.local`;
            const name = ldapResult.displayName || ldapResult.cn || ldapResult[usernameAttr];

            authLogger.info({ username }, "LDAP authentication successful");

            // Find or create user
            const existingUser = await ctx.context.internalAdapter.findUserByEmail(String(email));

            let user;

            if (existingUser) {
              user = existingUser.user;
            } else {
              // Create new user
              user = await ctx.context.internalAdapter.createUser({
                email: String(email),
                name: name ? String(name) : username,
                emailVerified: true,
              });
            }

            // Create session
            const session = await ctx.context.internalAdapter.createSession(user.id);

            // Set session cookie
            await ctx.setSignedCookie(
              ctx.context.authCookies.sessionToken.name,
              session.token,
              ctx.context.secret,
              ctx.context.authCookies.sessionToken.options
            );

            return ctx.json({
              user,
              session,
            });
          } catch (error) {
            authLogger.warn({ username, error }, "LDAP authentication failed");
            throw new APIError("UNAUTHORIZED", {
              message: "Invalid LDAP credentials",
            });
          }
        }
      ),
    },
  };
}
