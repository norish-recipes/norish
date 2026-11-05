import { AUTH_STORAGE_PREFIX, clearAuthStorage } from "@/lib/auth/auth-storage";
import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

let _client: ReturnType<typeof createAuthClient> | null = null;
let _currentBaseUrl: string | null = null;

export function getAuthClient(baseUrl: string): ReturnType<typeof createAuthClient> {
  if (_client && _currentBaseUrl === baseUrl) {
    return _client;
  }

  _client = createAuthClient({
    // Better Auth takes a URL with a path as the auth root, so a base-path server needs it spelled out.
    baseURL: `${baseUrl}/api/auth`,
    plugins: [
      expoClient({
        scheme: "norish",
        storagePrefix: AUTH_STORAGE_PREFIX,
        storage: SecureStore,
      }),
    ],
  });
  _currentBaseUrl = baseUrl;

  return _client;
}

export async function resetAuthClientStorage(): Promise<void> {
  await clearAuthStorage();
  _client = null;
  _currentBaseUrl = null;
}
