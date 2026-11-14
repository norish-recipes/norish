import { storageAdapter } from "@better-auth/expo/client";
import { Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("shared-keychain");

/** One keychain's items as SecureStore reads and writes them. */
export type KeychainStore = {
  getItem: (key: string) => string | null;
  getItemAsync: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => void;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

/** Written to the shared keychain once every value is there and reads back. */
const MOVED_KEY = "norish_keychain_moved";
// Better Auth's MAX_STORAGE_CHUNKS: a value is split over at most this many keys.
const MAX_CHUNKS = 100;

/** Deletes `key` and every chunk key Better Auth's adapter may have written for it. */
async function deleteWithChunks(store: KeychainStore, key: string): Promise<void> {
  for (const prefix of [key, `${key}.0`, `${key}.1`]) {
    for (let i = 0; i < MAX_CHUNKS && store.getItem(`${prefix}.${i}`) !== null; i++) {
      await store.deleteItemAsync(`${prefix}.${i}`);
    }
  }
  await store.deleteItemAsync(key);
}

/**
 * Moves `keys` from `old` into `shared`: until the marker is written the old items are the truth,
 * so a failed or interrupted move throws, leaves them, and is redone in full next time.
 */
export async function moveKeychainItems(
  old: KeychainStore,
  shared: KeychainStore,
  keys: readonly string[]
): Promise<void> {
  if ((await shared.getItemAsync(MOVED_KEY)) !== "1") {
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

  // Leftovers only: the shared items are the truth now, so a failure here is retried next launch.
  for (const key of keys) {
    await deleteWithChunks(old, key).catch((error: unknown) =>
      log.warn({ error, key }, "Could not delete a moved keychain item")
    );
  }
}

const SHARED_SERVICE = "norish.shared";

// The app's own keychain until the move succeeds; module scope, read on every access.
let options: SecureStore.SecureStoreOptions = {};
let moving: Promise<void> | null = null;

/** The keychain SecureStore calls name: the one shared with the Share Extension once moved. */
export function keychainOptions(): SecureStore.SecureStoreOptions {
  return options;
}

function secureStore(storeOptions: SecureStore.SecureStoreOptions): KeychainStore {
  return {
    getItem: (key) => SecureStore.getItem(key, storeOptions),
    getItemAsync: (key) => SecureStore.getItemAsync(key, storeOptions),
    setItem: (key, value) => SecureStore.setItem(key, value, storeOptions),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, storeOptions),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, storeOptions),
  };
}

/**
 * Once per launch, before any other SecureStore read: moves `keys` into the App Group's keychain
 * (an App Group is an access group on iOS). A failure keeps today's keychain for this launch.
 */
export function moveToSharedKeychain(keys: readonly string[]): Promise<void> {
  moving ??= (async () => {
    // Empty off iOS, where the store stays as it is.
    const appGroup = Object.keys(Paths.appleSharedContainers)[0];

    if (!appGroup) return;

    // A service of its own keeps old and moved items apart whatever group a query names.
    const shared: SecureStore.SecureStoreOptions = {
      keychainService: SHARED_SERVICE,
      accessGroup: appGroup,
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    };

    try {
      await moveKeychainItems(secureStore({}), secureStore(shared), keys);
      options = shared;
    } catch (error) {
      log.warn({ error }, "Keychain move failed; using the app's own keychain this launch");
    }
  })();

  return moving;
}
