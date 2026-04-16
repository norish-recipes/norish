import * as SecureStore from "expo-secure-store";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("auth-storage");

export const AUTH_STORAGE_PREFIX = "norish";

const AUTH_COOKIE_KEY = `${AUTH_STORAGE_PREFIX}_cookie`;
const AUTH_SESSION_DATA_KEY = `${AUTH_STORAGE_PREFIX}_session_data`;

export type PersistedUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

function readRequiredString(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return value;
}

function toPersistedUser(value: unknown): PersistedUser | null {
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
  const parsedName = readRequiredString(name);

  if (!parsedId || !parsedEmail || !parsedName) {
    return null;
  }

  if (image !== undefined && image !== null && typeof image !== "string") {
    return null;
  }

  return {
    id: parsedId,
    email: parsedEmail,
    name: parsedName,
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
export async function readPersistedSession(): Promise<PersistedUser | null> {
  let authCookie: string | null;
  let raw: string | null;

  try {
    [authCookie, raw] = await Promise.all([
      SecureStore.getItemAsync(AUTH_COOKIE_KEY),
      SecureStore.getItemAsync(AUTH_SESSION_DATA_KEY),
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

  const user = toPersistedUser(parsed);

  if (!user) {
    log.warn("Persisted session data has an invalid shape");
  }

  return user;
}

export async function clearAuthStorage(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(AUTH_COOKIE_KEY),
    SecureStore.deleteItemAsync(AUTH_SESSION_DATA_KEY),
  ]);
}
