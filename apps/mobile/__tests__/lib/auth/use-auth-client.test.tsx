// @vitest-environment jsdom
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => {
  const items = new Map<string, string>();

  return {
    getItemAsync: async (key: string) => items.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => void items.set(key, value),
    deleteItemAsync: async (key: string) => void items.delete(key),
  };
});
vi.mock("@/lib/auth/auth-storage", () => ({
  AUTH_STORAGE_PREFIX: "norish",
  clearAuthStorage: async () => {},
  claimClientStorage: () => ({}),
  retireClientStorage: () => {},
}));
vi.mock("@better-auth/expo/client", () => ({ expoClient: () => ({}) }));
vi.mock("better-auth/react", () => ({ createAuthClient: () => ({}) }));

const { useAuthClient } = await import("@/lib/auth/use-auth-client");
const { BackendBaseUrlContext, saveBackendBaseUrl } =
  await import("@/lib/network/backend-base-url");

const URL = "https://norish.test";

describe("useAuthClient", () => {
  it("has no client off the boot gate's server, though the connect screen just saved one", async () => {
    await saveBackendBaseUrl(URL);

    expect(renderHook(() => useAuthClient()).result.current).toBeNull();
  });

  it("has the client for the server the boot gate renders the app with", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <BackendBaseUrlContext value={URL}>{children}</BackendBaseUrlContext>
    );

    expect(renderHook(() => useAuthClient(), { wrapper }).result.current).not.toBeNull();
  });
});
