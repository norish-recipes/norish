import {
  getAuthClient,
  resetAuthClientStorage,
  subscribeAuthClientReset,
} from "@/lib/auth/auth-client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/auth-storage", () => ({
  AUTH_STORAGE_PREFIX: "norish",
  clearAuthStorage: async () => {},
}));
vi.mock("@better-auth/expo/client", () => ({ expoClient: () => ({}) }));
vi.mock("better-auth/react", () => ({ createAuthClient: () => ({}) }));
vi.mock("expo-secure-store", () => ({}));

const BASE_URL = "https://norish.test";

describe("getAuthClient", () => {
  it("hands the auth context a new client after a sign-out's reset, the one the engine gets too", async () => {
    const signedIn = getAuthClient(BASE_URL);
    // What the auth context's store does when told of a reset.
    const contextRereads = vi.fn(() => getAuthClient(BASE_URL));
    const unsubscribe = subscribeAuthClientReset(contextRereads);

    expect(getAuthClient(BASE_URL)).toBe(signedIn);

    await resetAuthClientStorage();
    unsubscribe();

    const contextClient = contextRereads.mock.results[0]?.value;

    expect(contextClient).not.toBe(signedIn);
    // The offline engine's read, without the context.
    expect(getAuthClient(BASE_URL)).toBe(contextClient);
  });
});
