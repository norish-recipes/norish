import {
  getAuthClient,
  resetAuthClientStorage,
  subscribeAuthClientReset,
} from "@/lib/auth/auth-client";
import { describe, expect, it, vi } from "vitest";

type Storage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

const clearAuthStorage = vi.hoisted(() => vi.fn(async () => {}));
// SecureStore in memory, and the storage each client's expo plugin was handed.
const secureStore = vi.hoisted(() => {
  const items = new Map<string, string>();

  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    getItemAsync: async (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    setItemAsync: async (key: string, value: string) => void items.set(key, value),
  };
});
const pluginStorages = vi.hoisted(() => [] as Storage[]);
const createAuthClient = vi.hoisted(() => vi.fn((_options: object) => ({})));

vi.mock("expo-file-system", () => ({ Paths: { appleSharedContainers: {} } }));
vi.mock("@/lib/auth/auth-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/auth-storage")>()),
  clearAuthStorage,
}));
vi.mock("@better-auth/expo/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@better-auth/expo/client")>()),
  expoClient: ({ storage }: { storage: Storage }) => void pluginStorages.push(storage),
}));
vi.mock("better-auth/react", () => ({ createAuthClient }));
vi.mock("expo-secure-store", () => secureStore);
vi.mock("expo-constants", () => ({ default: {} }));
vi.mock("expo-linking", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, AppState: {} }));

const BASE_URL = "https://norish.test";

describe("getAuthClient", () => {
  it("hands useAuthClient a new client after a sign-out's reset, the one the engine gets too", async () => {
    const signedIn = getAuthClient(BASE_URL);
    // What useAuthClient's store does when told of a reset.
    const hookRereads = vi.fn(() => getAuthClient(BASE_URL));
    const unsubscribe = subscribeAuthClientReset(hookRereads);

    expect(getAuthClient(BASE_URL)).toBe(signedIn);

    await resetAuthClientStorage();
    unsubscribe();

    const hookClient = hookRereads.mock.results[0]?.value;

    expect(hookClient).not.toBe(signedIn);
    // The offline engine's read, without the hook.
    expect(getAuthClient(BASE_URL)).toBe(hookClient);
  });

  it("still hands out a new client when the storage wipe fails, and rethrows", async () => {
    const signedIn = getAuthClient(BASE_URL);
    const hookRereads = vi.fn();
    const unsubscribe = subscribeAuthClientReset(hookRereads);

    clearAuthStorage.mockRejectedValueOnce(new Error("keychain locked"));

    await expect(resetAuthClientStorage()).rejects.toThrow("keychain locked");
    unsubscribe();

    expect(hookRereads).toHaveBeenCalledOnce();
    expect(getAuthClient(BASE_URL)).not.toBe(signedIn);
  });

  it("drops what a retired client writes, so a late session read cannot restore the departed reader", async () => {
    getAuthClient(BASE_URL);
    const retired = pluginStorages.at(-1);

    await resetAuthClientStorage();
    // The old client's session read answers after the wipe and stores its cookie and session.
    await retired?.setItemAsync("norish_cookie", "old-reader");
    retired?.setItem("norish_session_data", "old-reader");

    expect(secureStore.items.size).toBe(0);
    expect(await retired?.getItemAsync("norish_cookie")).toBeNull();

    getAuthClient(BASE_URL);
    await pluginStorages.at(-1)?.setItemAsync("norish_cookie", "new-reader");
    expect(secureStore.items.get("norish_cookie")).toBe("new-reader");
  });

  it("puts no deadline on every request, so a slow sign-up or session read still lands", () => {
    getAuthClient("https://deadline.test");

    expect(createAuthClient.mock.lastCall?.[0]).not.toHaveProperty("fetchOptions");
  });
});
