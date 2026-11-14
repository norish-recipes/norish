import { authHeaders } from "@/lib/auth/auth-headers";
import { claimClientStorage, clearAuthStorage, retireClientStorage } from "@/lib/auth/auth-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

const secureStore = vi.hoisted(() => {
  const items = new Map<string, string>();

  return {
    items,
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    getItemAsync: async (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    setItemAsync: async (key: string, value: string) => {
      await new Promise((bridge) => setTimeout(bridge, 0));
      items.set(key, value);
    },
    deleteItemAsync: async (key: string) => void items.delete(key),
  };
});

vi.mock("expo-file-system", () => ({ Paths: { appleSharedContainers: {} } }));
vi.mock("expo-secure-store", () => secureStore);
vi.mock("expo-constants", () => ({ default: {} }));
vi.mock("expo-linking", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, AppState: {} }));
vi.mock("@/lib/network/server-address", () => ({ getServerAddress: () => "https://norish.test" }));

const COOKIE_KEY = "norish_cookie";
const cookie = (value: string) =>
  JSON.stringify({ "better-auth.session_token": { value, expires: null } });

describe("authHeaders", () => {
  beforeEach(async () => {
    retireClientStorage();
    await clearAuthStorage();
    secureStore.items.set(COOKIE_KEY, cookie("one"));
    secureStore.getItem.mockClear();
  });

  it("reads the Keychain once, then answers from memory", () => {
    expect(authHeaders()).toEqual({ Cookie: "better-auth.session_token=one" });
    expect(authHeaders()).toEqual({ Cookie: "better-auth.session_token=one" });
    expect(secureStore.getItem).toHaveBeenCalledTimes(1);
  });

  it("answers the cookie the client wrote synchronously", () => {
    authHeaders();
    claimClientStorage().setItem(COOKIE_KEY, cookie("two"));

    expect(authHeaders()).toEqual({ Cookie: "better-auth.session_token=two" });
  });

  it("answers the cookie the client wrote asynchronously", async () => {
    const storage = claimClientStorage();

    authHeaders();
    await storage.setItemAsync(COOKIE_KEY, cookie("three"));

    expect(authHeaders()).toEqual({ Cookie: "better-auth.session_token=three" });
  });

  it("sends nothing once the session is cleared", async () => {
    authHeaders();
    retireClientStorage();
    await clearAuthStorage();

    expect(authHeaders()).toEqual({});
  });
});
