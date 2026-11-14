import { saveServerAddress, subscribeServerAddressChange } from "@/lib/network/server-address";
import { describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, string>());

vi.mock("@/lib/auth/auth-client", () => ({ resetAuthClientStorage: () => Promise.resolve() }));
vi.mock("@/lib/auth/auth-storage", () => ({ AUTH_STORAGE_KEYS: [] }));
vi.mock("@/lib/auth/app-keychain", () => ({
  appKeychain: {
    getItemAsync: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItemAsync: (key: string, value: string) => Promise.resolve(void store.set(key, value)),
    deleteItemAsync: (key: string) => Promise.resolve(void store.delete(key)),
  },
}));
vi.mock("@/lib/auth/shared-keychain", () => ({ moveToSharedKeychain: () => Promise.resolve() }));

describe("saveServerAddress", () => {
  it("announces a change only when the address really changes", async () => {
    const listener = vi.fn();

    subscribeServerAddressChange(listener);

    await saveServerAddress("norish.example.com");
    await saveServerAddress("https://norish.example.com/");

    expect(listener).toHaveBeenCalledTimes(1);

    await saveServerAddress("other.example.com");

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
