"use client";

import { apiKeyClient } from "@better-auth/api-key/client";
import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { BASE_PATH } from "../base-path";

type AuthClient = ReturnType<typeof createAuthClient> & {
  apiKey: unknown;
};

// The browser calls the auth routes at their public path, so a prefixed
// instance reaches /norish/api/auth; Next.js strips the prefix before the
// Route Handler sees it (ADR-0040).
const authClient: AuthClient = createAuthClient({
  basePath: `${BASE_PATH}/api/auth`,
  plugins: [apiKeyClient(), genericOAuthClient()],
});

// Export commonly used functions
export const { signIn, signOut, signUp, getSession, useSession, apiKey } = authClient;

// Export the full client for advanced usage
export { authClient };
