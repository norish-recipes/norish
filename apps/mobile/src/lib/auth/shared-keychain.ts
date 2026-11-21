import type { KeychainStore } from "@/lib/auth/app-keychain";
import { secureStore, setAppKeychainOptions } from "@/lib/auth/app-keychain";
import { storageAdapter } from "@better-auth/expo/client";
import { Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("shared-keychain");

/** Written to the shared keychain once every value is there and reads back. */
export const MOVED_KEY = "norish_keychain_moved";
// Better Auth's MAX_STORAGE_CHUNKS: a value is split over at most this many keys.
export const MAX_CHUNKS = 100;

/** Deletes `key` and every chunk key Better Auth's adapter may have written for it. */
async function deleteWithChunks(store: KeychainStore, key: string): Promise<void> {
  for (const prefix of [key, `${key}.0`, `${key}.1`]) {
    for (let i = 0; i < MAX_CHUNKS && store.getItem(`${prefix}.${i}`) !== null; i++) {
      await store.deleteItemAsync(`${prefix}.${i}`);
    }
  }
  await store.deleteItemAsync(key);
}

/** Copies every logical value of `keys` into `shared`, reads each back, then writes the marker. */
async function copyKeychainItems(
  old: KeychainStore,
  shared: KeychainStore,
  keys: readonly string[]
): Promise<void> {
  const from = storageAdapter(old);
  const to = storageAdapter(shared);

  for (const key of keys) {
    const value = await from.getItemAsync(key);

    // A copy an earlier attempt left must not outlive the old item it copied.
    if (value === null) await deleteWithChunks(shared, key);
    else await to.setItemAsync(key, value);

    if ((await to.getItemAsync(key)) !== value) throw new Error(`${key} did not read back`);
  }
  await shared.setItemAsync(MOVED_KEY, "1");
}

/**
 * Moves `keys` from `old` into `shared`; true once the shared items are the truth. A failed copy
 * leaves the old items and answers false; a marker read that throws is a storage failure and rethrows.
 */
export async function moveKeychainItems(
  old: KeychainStore,
  shared: KeychainStore,
  keys: readonly string[]
): Promise<boolean> {
  if ((await shared.getItemAsync(MOVED_KEY)) !== "1") {
    try {
      await copyKeychainItems(old, shared, keys);
    } catch (error) {
      log.warn({ error }, "Keychain move failed; using the app's own keychain this launch");

      return false;
    }
  }

  // Leftovers only: the shared items are the truth now, so a failure here is retried next launch.
  for (const key of keys) {
    await deleteWithChunks(old, key).catch((error: unknown) =>
      log.warn({ error, key }, "Could not delete a moved keychain item")
    );
  }

  return true;
}

export const SHARED_SERVICE = "norish.shared";

let moving: Promise<void> | null = null;

async function moveOnce(keys: readonly string[]): Promise<void> {
  // Empty off iOS, where the store stays as it is.
  const appGroup = Object.keys(Paths.appleSharedContainers)[0];

  if (!appGroup) return;

  // A service of its own keeps old and moved items apart whatever group a query names.
  const shared: SecureStore.SecureStoreOptions = {
    keychainService: SHARED_SERVICE,
    accessGroup: appGroup,
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  };

  if (
    await moveKeychainItems(
      secureStore(() => ({})),
      secureStore(() => shared),
      keys
    )
  ) {
    setAppKeychainOptions(shared);
  }
}

/**
 * Once per launch, before any other SecureStore read: moves `keys` into the App Group's keychain
 * (an App Group is an access group on iOS). A failed copy keeps today's keychain for this launch.
 */
export function moveToSharedKeychain(keys: readonly string[]): Promise<void> {
  if (!moving) {
    const attempt = moveOnce(keys);

    moving = attempt;
    // A storage failure is not cached, so the boot's Retry reads the marker again.
    attempt.catch(() => {
      if (moving === attempt) moving = null;
    });
  }

  return moving;
}
