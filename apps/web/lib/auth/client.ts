"use client";
import { createAuthClient } from "better-auth/react";
import { apiKeyClient, genericOAuthClient } from "better-auth/client/plugins";

// Create auth client with React hooks support
const authClient = createAuthClient({
  plugins: [apiKeyClient(), genericOAuthClient()],
});

// Export commonly used functions
export const { signIn, signOut, signUp, getSession, useSession, apiKey } = authClient;

// Export the full client for advanced usage
export { authClient };
