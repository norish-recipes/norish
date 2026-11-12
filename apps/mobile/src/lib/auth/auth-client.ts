import {
  AUTH_STORAGE_PREFIX,
  claimClientStorage,
  clearAuthStorage,
  retireClientStorage,
} from "@/lib/auth/auth-storage";
import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";

import { REACHABILITY_DEADLINE_MS } from "@norish/shared-react/offline/reachability";

export type AuthClient = ReturnType<typeof createAuthClient>;

let _client: AuthClient | null = null;
let _currentBaseUrl: string | null = null;
const resetListeners = new Set<() => void>();

export function getAuthClient(baseUrl: string): AuthClient {
  if (_client && _currentBaseUrl === baseUrl) {
    return _client;
  }

  _client = createAuthClient({
    // Better Auth takes a URL with a path as the auth root, so a base-path server needs it spelled out.
    baseURL: `${baseUrl}/api/auth`,
    // A stalled server fails the attempt instead of holding every Sign-in Method until iOS gives up.
    fetchOptions: { timeout: REACHABILITY_DEADLINE_MS },
    plugins: [
      expoClient({
        scheme: "norish",
        storagePrefix: AUTH_STORAGE_PREFIX,
        // A request still in flight on the replaced client must not write its session back.
        storage: claimClientStorage(),
      }),
    ],
  });
  _currentBaseUrl = baseUrl;

  return _client;
}

/** Calls `listener` after each reset, when the next getAuthClient builds a new client. */
export function subscribeAuthClientReset(listener: () => void): () => void {
  resetListeners.add(listener);

  return () => {
    resetListeners.delete(listener);
  };
}

/** Retires the client, wipes the stored session and drops it; a failed wipe still drops it, then rethrows. */
export async function resetAuthClientStorage(): Promise<void> {
  retireClientStorage();

  try {
    await clearAuthStorage();
  } finally {
    _client = null;
    _currentBaseUrl = null;

    for (const listener of resetListeners) listener();
  }
}
