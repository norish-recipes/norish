import type { KeychainStore } from "@/lib/auth/app-keychain";
import { appKeychain } from "@/lib/auth/app-keychain";
import { storageAdapter } from "@better-auth/expo/client";

import type { SessionUser } from "@norish/shared-react/reader";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("auth-storage");

export const AUTH_STORAGE_PREFIX = "norish";

export const AUTH_COOKIE_KEY = `${AUTH_STORAGE_PREFIX}_cookie`;
export const AUTH_SESSION_DATA_KEY = `${AUTH_STORAGE_PREFIX}_session_data`;

/** The keys the auth client stores, each with the chunk keys Better Auth splits it over. */
export const AUTH_STORAGE_KEYS = [AUTH_COOKIE_KEY, AUTH_SESSION_DATA_KEY] as const;

type ClientStorage = Pick<KeychainStore, "getItem" | "getItemAsync" | "setItem" | "setItemAsync">;

// The stored cookie as last read, so headers skip the Keychain; undefined until read or after a write.
let storedCookie: string | null | undefined;

function forgetCookie(key: string): void {
  if (key.startsWith(AUTH_COOKIE_KEY)) storedCookie = undefined;
}

/** The stored cookie JSON, read from the Keychain once per write to it. */
export function readStoredCookie(): string | null {
  if (storedCookie === undefined) storedCookie = authStorage().getItem(AUTH_COOKIE_KEY);

  return storedCookie;
}

/** SecureStore for one client; once retired, its reads answer empty and its writes are dropped. */
function retirableStorage() {
  let retired = false;
  const storage: ClientStorage = {
    getItem: (key) => (retired ? null : appKeychain.getItem(key)),
    getItemAsync: async (key) => (retired ? null : appKeychain.getItemAsync(key)),
    setItem: (key, value) => {
      if (retired) return;
      appKeychain.setItem(key, value);
      forgetCookie(key);
    },
    setItemAsync: async (key, value) => {
      if (retired) return;
      await appKeychain.setItemAsync(key, value);
      forgetCookie(key);
    },
  };

  // The plugin queues reads and writes per storage object, so readers share the client's queue.
  return {
    storage,
    adapter: storageAdapter(storage),
    claimed: false,
    retire: () => {
      retired = true;
    },
  };
}

let current = retirableStorage();

/** SecureStore as the current auth client reads it: chunked, and queued behind its writes. */
export function authStorage() {
  return current.adapter;
}

/** The storage a new auth client writes through; a replaced client's is retired first. */
export function claimClientStorage(): ClientStorage {
  if (current.claimed) retireClientStorage();
  current.claimed = true;

  return current.storage;
}

/** Drops whatever the current client still writes; readers move to a fresh storage. */
export function retireClientStorage(): void {
  current.retire();
  current = retirableStorage();
  storedCookie = undefined;
}

function readRequiredString(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return value;
}

function toSessionUser(value: unknown): SessionUser | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const user = (value as { user?: unknown }).user;

  if (typeof user !== "object" || user === null) {
    return null;
  }

  const { id, email, name, image } = user as {
    id?: unknown;
    email?: unknown;
    name?: unknown;
    image?: unknown;
  };

  const parsedId = readRequiredString(id);
  const parsedEmail = readRequiredString(email);

  // An empty name is still a reader, as the live session reads it.
  if (!parsedId || !parsedEmail || typeof name !== "string") {
    return null;
  }

  if (image !== undefined && image !== null && typeof image !== "string") {
    return null;
  }

  return {
    id: parsedId,
    email: parsedEmail,
    name,
    image: image ?? null,
  };
}

/** The user in Better Auth's persisted session data in SecureStore; null when the key is missing,
 * empty, unparseable or holds no valid user. */
export async function readPersistedSession(): Promise<SessionUser | null> {
  let authCookie: string | null;
  let raw: string | null;

  try {
    [authCookie, raw] = await Promise.all([
      authStorage().getItemAsync(AUTH_COOKIE_KEY),
      authStorage().getItemAsync(AUTH_SESSION_DATA_KEY),
    ]);
  } catch {
    log.warn("Failed to read persisted auth data from SecureStore");

    return null;
  }

  if (!authCookie) {
    return null;
  }

  if (!raw) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    log.warn("Failed to parse persisted session data from SecureStore");

    return null;
  }

  const user = toSessionUser(parsed);

  if (!user) {
    log.warn("Persisted session data has an invalid shape");
  }

  return user;
}

/** Wipes both keys, each settled before a failed one rejects, so the client is replaced after both. */
export async function clearAuthStorage(): Promise<void> {
  // The adapter has no delete; writing "" through it empties every chunk, then the key goes.
  const wipes = await Promise.allSettled(
    AUTH_STORAGE_KEYS.map(async (key) => {
      await authStorage().setItemAsync(key, "");
      await appKeychain.deleteItemAsync(key);
      forgetCookie(key);
    })
  );
  const failed = wipes.find((wipe): wipe is PromiseRejectedResult => wipe.status === "rejected");

  if (failed) throw failed.reason;
}
