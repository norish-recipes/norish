"use client";

import { apiKeyClient } from "@better-auth/api-key/client";
import { createAuthClient } from "better-auth/react";

import { BASE_PATH } from "../base-path";

// The browser calls the auth routes at their public path, base path included.
const authClient = createAuthClient({
  basePath: `${BASE_PATH}/api/auth`,
  plugins: [apiKeyClient()],
});

// Export commonly used functions
export const { signIn, signOut, signUp, getSession, useSession, apiKey } = authClient;

// Export the full client for advanced usage
export { authClient };
