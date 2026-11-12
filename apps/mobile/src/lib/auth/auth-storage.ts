import { storageAdapter } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

import type { SessionUser } from "@norish/shared-react/reader";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("auth-storage");

export const AUTH_STORAGE_PREFIX = "norish";

export const AUTH_COOKIE_KEY = `${AUTH_STORAGE_PREFIX}_cookie`;
const AUTH_SESSION_DATA_KEY = `${AUTH_STORAGE_PREFIX}_session_data`;

/** SecureStore as the auth client reads it: a large value is stored in chunks. */
export const authStorage = storageAdapter(SecureStore);

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

/**
 * Read the persisted Better Auth session data from SecureStore and extract
 * the user object.
 *
 * Returns the validated user object, or `null` if the key is missing, empty,
 * unparseable, or the user shape is invalid.
 */
export async function readPersistedSession(): Promise<SessionUser | null> {
  let authCookie: string | null;
  let raw: string | null;

  try {
    [authCookie, raw] = await Promise.all([
      authStorage.getItemAsync(AUTH_COOKIE_KEY),
      authStorage.getItemAsync(AUTH_SESSION_DATA_KEY),
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

export async function clearAuthStorage(): Promise<void> {
  // The adapter has no delete; writing "" through it empties every chunk, then the key goes.
  await Promise.all(
    [AUTH_COOKIE_KEY, AUTH_SESSION_DATA_KEY].map(async (key) => {
      await authStorage.setItemAsync(key, "");
      await SecureStore.deleteItemAsync(key);
    })
  );
}
