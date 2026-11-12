import { clearAuthStorage, readPersistedSession } from "@/lib/auth/auth-storage";
import { storageAdapter } from "@better-auth/expo/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for readPersistedSession() — the SecureStore-based offline session reader.
 *
 * We mock expo-secure-store and the logger to test pure logic without
 * requiring the React Native runtime.
 */

// An in-memory SecureStore, so values the auth client chunks read back the way it wrote them.
const secureStore = vi.hoisted(() => {
  const items = new Map<string, string>();

  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    getItemAsync: async (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    setItemAsync: async (key: string, value: string) => void items.set(key, value),
    deleteItemAsync: vi.fn(async (key: string): Promise<void> => void items.delete(key)),
  };
});
const COOKIE_KEY = "norish_cookie";
const SESSION_DATA_KEY = "norish_session_data";

let cookieValue: string | null = null;
let sessionDataValue: string | null = null;

function setSessionData(value: unknown): void {
  sessionDataValue = typeof value === "string" ? value : JSON.stringify(value);
}

vi.mock("expo-secure-store", () => secureStore);
vi.mock("expo-constants", () => ({ default: {} }));
vi.mock("expo-linking", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, AppState: {} }));

describe("readPersistedSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    secureStore.items.clear();
    cookieValue = "session-token=abc";
    sessionDataValue = null;
  });

  async function read() {
    if (cookieValue !== null) secureStore.items.set(COOKIE_KEY, cookieValue);
    if (sessionDataValue !== null) secureStore.items.set(SESSION_DATA_KEY, sessionDataValue);

    return readPersistedSession();
  }

  it("reads a session the auth client stored in chunks", async () => {
    const user = { id: "user-123", email: "test@example.com", name: "Test User", image: null };

    await storageAdapter(secureStore).setItemAsync(
      SESSION_DATA_KEY,
      JSON.stringify({ user, session: { token: "abc", padding: "x".repeat(5000) } })
    );
    cookieValue = "session-token=abc";

    await expect(read()).resolves.toEqual(user);
  });

  it("returns user object for a valid persisted session", async () => {
    const sessionData = {
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        image: "https://example.com/avatar.jpg",
      },
      session: { token: "abc" },
    };

    setSessionData(sessionData);

    const result = await read();

    expect(result).toEqual({
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      image: "https://example.com/avatar.jpg",
    });
  });

  it("returns user with null image when image is null", async () => {
    const sessionData = {
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        image: null,
      },
    };

    setSessionData(sessionData);

    const result = await read();

    expect(result).toEqual({
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      image: null,
    });
  });

  it("returns user with null image when image is absent", async () => {
    const sessionData = {
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
      },
    };

    setSessionData(sessionData);

    const result = await read();

    expect(result).toEqual({
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      image: null,
    });
  });

  it("returns null when key is missing (null)", async () => {
    sessionDataValue = null;

    const result = await read();

    expect(result).toBeNull();
  });

  it("returns null when key is empty string", async () => {
    setSessionData("");

    const result = await read();

    expect(result).toBeNull();
  });

  it("returns null for malformed JSON", async () => {
    setSessionData("not valid json {{{");

    const result = await read();

    expect(result).toBeNull();
  });

  it("returns null when parsed data is not an object", async () => {
    setSessionData('"just a string"');

    const result = await read();

    expect(result).toBeNull();
  });

  it("returns null when parsed data is an array", async () => {
    setSessionData("[1, 2, 3]");

    const result = await read();

    expect(result).toBeNull();
  });

  it("returns null when user object is missing", async () => {
    setSessionData({ session: { token: "abc" } });

    const result = await read();

    expect(result).toBeNull();
  });

  it("returns null when user is null", async () => {
    setSessionData({ user: null });

    const result = await read();

    expect(result).toBeNull();
  });

  it("returns null when user is a string (not an object)", async () => {
    setSessionData({ user: "not-an-object" });

    const result = await read();

    expect(result).toBeNull();
  });

  it("returns null when user.id is missing", async () => {
    setSessionData({
      user: { email: "test@example.com", name: "Test User" },
    });

    const result = await read();

    expect(result).toBeNull();
  });

  it("returns null when user.email is empty", async () => {
    setSessionData({
      user: { id: "user-123", email: "", name: "Test User" },
    });

    const result = await read();

    expect(result).toBeNull();
  });

  it("keeps a user whose name is empty", async () => {
    setSessionData({
      user: { id: "user-123", email: "test@example.com", name: "" },
    });

    const result = await read();

    expect(result).toEqual({ id: "user-123", email: "test@example.com", name: "", image: null });
  });

  it("returns null when user.id is a number instead of string", async () => {
    setSessionData({
      user: { id: 123, email: "test@example.com", name: "Test" },
    });

    const result = await read();

    expect(result).toBeNull();
  });

  it("returns null when user.image is a non-string type", async () => {
    setSessionData({
      user: { id: "user-123", email: "test@example.com", name: "Test", image: 42 },
    });

    const result = await read();

    expect(result).toBeNull();
  });

  it("returns null when auth cookie is missing even if session data exists", async () => {
    cookieValue = null;
    setSessionData({
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
      },
    });

    const result = await read();

    expect(result).toBeNull();
  });
});

describe("clearAuthStorage", () => {
  it("leaves no session value behind, chunks included", async () => {
    secureStore.items.clear();
    await storageAdapter(secureStore).setItemAsync(SESSION_DATA_KEY, "x".repeat(5000));
    await storageAdapter(secureStore).setItemAsync(COOKIE_KEY, "session-token=abc");

    await clearAuthStorage();

    expect([...secureStore.items.values()].filter(Boolean)).toEqual([]);
  });

  it("lets every key's wipe settle before it reports one that failed", async () => {
    secureStore.items.clear();
    await storageAdapter(secureStore).setItemAsync(SESSION_DATA_KEY, "x".repeat(5000));
    await storageAdapter(secureStore).setItemAsync(COOKIE_KEY, "session-token=abc");
    const wipe = async (key: string) => {
      if (key === COOKIE_KEY) throw new Error("keychain locked");
      await new Promise((resolve) => setTimeout(resolve, 10));
      secureStore.items.delete(key);
    };

    secureStore.deleteItemAsync.mockImplementationOnce(wipe).mockImplementationOnce(wipe);

    await expect(clearAuthStorage()).rejects.toThrow("keychain locked");
    expect(secureStore.items.has(SESSION_DATA_KEY)).toBe(false);
  });
});
