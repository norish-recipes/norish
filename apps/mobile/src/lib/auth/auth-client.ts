import { AUTH_STORAGE_PREFIX, clearAuthStorage } from "@/lib/auth/auth-storage";
import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

export type AuthClient = ReturnType<typeof createAuthClient>;

type ClientStorage = Pick<
  typeof SecureStore,
  "getItem" | "getItemAsync" | "setItem" | "setItemAsync"
>;

let _client: AuthClient | null = null;
let _currentBaseUrl: string | null = null;
let _retireClient: (() => void) | null = null;
const resetListeners = new Set<() => void>();

/** SecureStore for one client; once retired, its reads answer empty and its writes are dropped. */
function retirableStorage(): { storage: ClientStorage; retire: () => void } {
  let retired = false;

  return {
    storage: {
      getItem: (...args) => (retired ? null : SecureStore.getItem(...args)),
      getItemAsync: async (...args) => (retired ? null : SecureStore.getItemAsync(...args)),
      setItem: (...args) => {
        if (!retired) SecureStore.setItem(...args);
      },
      setItemAsync: async (...args) => {
        if (!retired) await SecureStore.setItemAsync(...args);
      },
    },
    retire: () => {
      retired = true;
    },
  };
}

export function getAuthClient(baseUrl: string): AuthClient {
  if (_client && _currentBaseUrl === baseUrl) {
    return _client;
  }

  // A request still in flight on the replaced client must not write its session back.
  _retireClient?.();
  const { storage, retire } = retirableStorage();

  _retireClient = retire;
  _client = createAuthClient({
    // Better Auth takes a URL with a path as the auth root, so a base-path server needs it spelled out.
    baseURL: `${baseUrl}/api/auth`,
    plugins: [
      expoClient({
        scheme: "norish",
        storagePrefix: AUTH_STORAGE_PREFIX,
        storage,
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
  _retireClient?.();
  _retireClient = null;

  try {
    await clearAuthStorage();
  } finally {
    _client = null;
    _currentBaseUrl = null;

    for (const listener of resetListeners) listener();
  }
}
