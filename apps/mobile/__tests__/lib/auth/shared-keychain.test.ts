import type { KeychainStore } from "@/lib/auth/app-keychain";
import { moveKeychainItems } from "@/lib/auth/shared-keychain";
import { storageAdapter } from "@better-auth/expo/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// SecureStore as two fake keychains, told apart by the service a call names.
const secureStores = vi.hoisted(() => ({ app: null, shared: null }) as Record<string, unknown>);

vi.mock("expo-secure-store", () => {
  const store = (options?: { keychainService?: string }) =>
    secureStores[options?.keychainService ? "shared" : "app"] as KeychainStore;

  return {
    WHEN_UNLOCKED: 0,
    getItem: (key: string, options?: object) => store(options).getItem(key),
    getItemAsync: (key: string, options?: object) => store(options).getItemAsync(key),
    setItem: (key: string, value: string, options?: object) => store(options).setItem(key, value),
    setItemAsync: (key: string, value: string, options?: object) =>
      store(options).setItemAsync(key, value),
    deleteItemAsync: (key: string, options?: object) => store(options).deleteItemAsync(key),
  };
});
vi.mock("expo-file-system", () => ({ Paths: { appleSharedContainers: { "group.test": {} } } }));
vi.mock("expo-constants", () => ({ default: {} }));
vi.mock("expo-linking", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, AppState: {} }));

const KEYS = ["norish.backend-base-url", "norish_cookie", "norish_session_data"] as const;
const MOVED = "norish_keychain_moved";
// Over Better Auth's 1800-byte chunk size, so the cookie is stored as a marker and chunk keys.
const COOKIE = JSON.stringify({ "better-auth.session_token": { value: "t".repeat(4000) } });

/** A keychain in memory; `failWrites` makes every write of a key that starts with it throw. */
function fakeStore(failWrites?: string) {
  const items = new Map<string, string>();
  const calls: string[] = [];
  const write = (key: string, value: string) => {
    calls.push(`set ${key}`);
    if (failWrites && key.startsWith(failWrites)) throw new Error("keychain write failed");
    items.set(key, value);
  };
  const store: KeychainStore = {
    getItem: (key) => items.get(key) ?? null,
    getItemAsync: async (key) => {
      calls.push(`get ${key}`);

      return items.get(key) ?? null;
    },
    setItem: write,
    setItemAsync: async (key, value) => write(key, value),
    deleteItemAsync: async (key) => {
      calls.push(`delete ${key}`);
      items.delete(key);
    },
  };

  return { items, calls, store, read: (key: string) => storageAdapter(store).getItemAsync(key) };
}

/** What the app's auth client and Server Address left in the old keychain. */
async function signedIn(old: ReturnType<typeof fakeStore>) {
  const adapter = storageAdapter(old.store);

  await adapter.setItemAsync("norish.backend-base-url", "https://norish.test");
  await adapter.setItemAsync("norish_cookie", COOKIE);
  await adapter.setItemAsync("norish_session_data", '{"user":{"id":"u1"}}');
}

describe("moveKeychainItems", () => {
  it("marks a fresh install moved and writes nothing else", async () => {
    const old = fakeStore();
    const shared = fakeStore();

    await moveKeychainItems(old.store, shared.store, KEYS);

    expect([...shared.items]).toEqual([[MOVED, "1"]]);
  });

  it("moves an upgrade's items, chunks included, and leaves nothing under the old keychain", async () => {
    const old = fakeStore();
    const shared = fakeStore();

    await signedIn(old);
    expect(old.items.size).toBeGreaterThan(KEYS.length);

    await moveKeychainItems(old.store, shared.store, KEYS);

    expect(await shared.read("norish_cookie")).toBe(COOKIE);
    expect(await shared.read("norish.backend-base-url")).toBe("https://norish.test");
    expect(await shared.read("norish_session_data")).toBe('{"user":{"id":"u1"}}');
    expect(old.items.size).toBe(0);
  });

  it("redoes an interrupted move from the old items, dropping a copy whose original is gone", async () => {
    const old = fakeStore();
    const shared = fakeStore();
    const sharedAdapter = storageAdapter(shared.store);

    await signedIn(old);
    await storageAdapter(old.store).setItemAsync("norish_session_data", "");
    await old.store.deleteItemAsync("norish_session_data");
    // An earlier launch copied stale values and stopped before the marker.
    await sharedAdapter.setItemAsync("norish_cookie", '{"stale":{"value":"x"}}');
    await sharedAdapter.setItemAsync("norish_session_data", '{"user":{"id":"old"}}');

    await moveKeychainItems(old.store, shared.store, KEYS);

    expect(await shared.read("norish_cookie")).toBe(COOKIE);
    expect(await shared.read("norish_session_data")).toBeNull();
    expect(shared.items.get(MOVED)).toBe("1");
    expect(old.items.size).toBe(0);
  });

  it("only deletes leftovers once moved, never copying them over newer shared values", async () => {
    const old = fakeStore();
    const shared = fakeStore();

    await signedIn(old);
    await storageAdapter(shared.store).setItemAsync("norish_cookie", '{"newer":{"value":"n"}}');
    shared.items.set(MOVED, "1");

    await moveKeychainItems(old.store, shared.store, KEYS);

    expect(await shared.read("norish_cookie")).toBe('{"newer":{"value":"n"}}');
    expect(old.items.size).toBe(0);
  });

  it("answers false and keeps the old items when a shared write fails, so nothing signs out", async () => {
    const old = fakeStore();
    const shared = fakeStore("norish_cookie");

    await signedIn(old);
    const before = new Map(old.items);

    await expect(moveKeychainItems(old.store, shared.store, KEYS)).resolves.toBe(false);

    expect(old.items).toEqual(before);
    expect(shared.items.has(MOVED)).toBe(false);
  });

  it("settles once marked even when an old item cannot be deleted, for the next launch to retry", async () => {
    const old = fakeStore();
    const shared = fakeStore();

    await signedIn(old);
    old.store.deleteItemAsync = async () => {
      throw new Error("keychain delete failed");
    };

    await moveKeychainItems(old.store, shared.store, KEYS);

    expect(shared.items.get(MOVED)).toBe("1");
    expect(await shared.read("norish_cookie")).toBe(COOKIE);
  });
});

describe("moveToSharedKeychain", () => {
  let old: ReturnType<typeof fakeStore>;
  let shared: ReturnType<typeof fakeStore>;

  beforeEach(() => {
    vi.resetModules();
    old = fakeStore();
    shared = fakeStore();
    secureStores.app = old.store;
    secureStores.shared = shared.store;
  });

  const load = async () => ({
    ...(await import("@/lib/auth/shared-keychain")),
    ...(await import("@/lib/auth/app-keychain")),
  });
  // Which store the app's keychain reads now, by a key only that store holds.
  const reading = async (appKeychain: KeychainStore) => {
    old.items.set("probe", "old");
    shared.items.set("probe", "shared");

    return appKeychain.getItemAsync("probe");
  };

  it("rethrows a marker read that throws, touches neither store, and reads it again next call", async () => {
    const { moveToSharedKeychain, appKeychain } = await load();

    await signedIn(old);
    shared.items.set(MOVED, "1");
    old.calls.length = 0;
    const getItemAsync = shared.store.getItemAsync;

    // A launch while the phone is locked: the keychain refuses every read.
    shared.store.getItemAsync = async () => {
      throw new Error("interaction not allowed");
    };

    await expect(moveToSharedKeychain(KEYS)).rejects.toThrow("interaction not allowed");
    expect(old.calls).toEqual([]);
    expect(shared.calls).toEqual([]);
    shared.store.getItemAsync = getItemAsync;
    expect(await reading(appKeychain)).toBe("old");

    await moveToSharedKeychain(KEYS);

    expect(await reading(appKeychain)).toBe("shared");
  });

  it("reads the shared store once moved, whatever the old store does", async () => {
    const { moveToSharedKeychain, appKeychain } = await load();
    const broken = async () => {
      throw new Error("old keychain broken");
    };

    shared.items.set(MOVED, "1");
    old.store.getItemAsync = broken;
    old.store.deleteItemAsync = broken;
    old.store.getItem = () => {
      throw new Error("old keychain broken");
    };

    await moveToSharedKeychain(KEYS);
    old.store.getItemAsync = async () => "old";

    expect(await reading(appKeychain)).toBe("shared");
  });

  it("keeps the old store for this launch when the copy fails", async () => {
    const { moveToSharedKeychain, appKeychain } = await load();

    await signedIn(old);
    shared.store.setItemAsync = async () => {
      throw new Error("keychain write failed");
    };

    await moveToSharedKeychain(KEYS);

    expect(await reading(appKeychain)).toBe("old");
  });
});
