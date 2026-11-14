import type { KeychainStore } from "@/lib/auth/shared-keychain";
import { moveKeychainItems } from "@/lib/auth/shared-keychain";
import { storageAdapter } from "@better-auth/expo/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({}));
vi.mock("expo-file-system", () => ({ Paths: {} }));
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
  const write = (key: string, value: string) => {
    if (failWrites && key.startsWith(failWrites)) throw new Error("keychain write failed");
    items.set(key, value);
  };
  const store: KeychainStore = {
    getItem: (key) => items.get(key) ?? null,
    getItemAsync: async (key) => items.get(key) ?? null,
    setItem: write,
    setItemAsync: async (key, value) => write(key, value),
    deleteItemAsync: async (key) => void items.delete(key),
  };

  return { items, store, read: (key: string) => storageAdapter(store).getItemAsync(key) };
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

  it("throws and keeps the old items when a shared write fails, so nothing signs out", async () => {
    const old = fakeStore();
    const shared = fakeStore("norish_cookie");

    await signedIn(old);
    const before = new Map(old.items);

    await expect(moveKeychainItems(old.store, shared.store, KEYS)).rejects.toThrow();

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
