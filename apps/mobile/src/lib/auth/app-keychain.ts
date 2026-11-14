import * as SecureStore from "expo-secure-store";

/** One keychain's items as SecureStore reads and writes them. */
export type KeychainStore = {
  getItem: (key: string) => string | null;
  getItemAsync: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => void;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

/** SecureStore under the options `storeOptions` returns at each call. */
export function secureStore(storeOptions: () => SecureStore.SecureStoreOptions): KeychainStore {
  return {
    getItem: (key) => SecureStore.getItem(key, storeOptions()),
    getItemAsync: (key) => SecureStore.getItemAsync(key, storeOptions()),
    setItem: (key, value) => SecureStore.setItem(key, value, storeOptions()),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, storeOptions()),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, storeOptions()),
  };
}

// The app's own keychain until the move succeeds; module scope, read on every access.
let options: SecureStore.SecureStoreOptions = {};

/** The app's keychain: the one shared with the Share Extension once moved. */
export const appKeychain = secureStore(() => options);

/** Points the app's keychain at the store the move settled on. */
export function setAppKeychainOptions(next: SecureStore.SecureStoreOptions): void {
  options = next;
}
