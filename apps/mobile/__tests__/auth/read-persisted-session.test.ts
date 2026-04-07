import { beforeEach, describe, expect, it, vi } from "vitest";

import { readPersistedSession } from "../../src/lib/auth-storage";

/**
 * Tests for readPersistedSession() — the SecureStore-based offline session reader.
 *
 * We mock expo-secure-store and the logger to test pure logic without
 * requiring the React Native runtime.
 */

// Mock expo-secure-store
const mockGetItemAsync = vi.fn<(key: string) => Promise<string | null>>();
const COOKIE_KEY = "norish_cookie";
const SESSION_DATA_KEY = "norish_session_data";

let cookieValue: string | null = null;
let sessionDataValue: string | null = null;

function setSessionData(value: unknown): void {
  sessionDataValue = typeof value === "string" ? value : JSON.stringify(value);
}

vi.mock("expo-secure-store", () => ({
  getItemAsync: (...args: Parameters<typeof mockGetItemAsync>) => mockGetItemAsync(...args),
  deleteItemAsync: vi.fn(),
}));

// Mock logger
vi.mock("@norish/shared/lib/logger", () => ({
  createClientLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("readPersistedSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieValue = "session-token=abc";
    sessionDataValue = null;
    mockGetItemAsync.mockImplementation(async (key) => {
      if (key === COOKIE_KEY) {
        return cookieValue;
      }

      if (key === SESSION_DATA_KEY) {
        return sessionDataValue;
      }

      return null;
    });
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

    const result = await readPersistedSession();

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

    const result = await readPersistedSession();

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

    const result = await readPersistedSession();

    expect(result).toEqual({
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      image: null,
    });
  });

  it("returns null when key is missing (null)", async () => {
    sessionDataValue = null;

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });

  it("returns null when key is empty string", async () => {
    setSessionData("");

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });

  it("returns null for malformed JSON", async () => {
    setSessionData("not valid json {{{");

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });

  it("returns null when parsed data is not an object", async () => {
    setSessionData('"just a string"');

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });

  it("returns null when parsed data is an array", async () => {
    setSessionData("[1, 2, 3]");

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });

  it("returns null when user object is missing", async () => {
    setSessionData({ session: { token: "abc" } });

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });

  it("returns null when user is null", async () => {
    setSessionData({ user: null });

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });

  it("returns null when user is a string (not an object)", async () => {
    setSessionData({ user: "not-an-object" });

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });

  it("returns null when user.id is missing", async () => {
    setSessionData({
      user: { email: "test@example.com", name: "Test User" },
    });

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });

  it("returns null when user.email is empty", async () => {
    setSessionData({
      user: { id: "user-123", email: "", name: "Test User" },
    });

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });

  it("returns null when user.name is empty", async () => {
    setSessionData({
      user: { id: "user-123", email: "test@example.com", name: "" },
    });

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });

  it("returns null when user.id is a number instead of string", async () => {
    setSessionData({
      user: { id: 123, email: "test@example.com", name: "Test" },
    });

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });

  it("returns null when user.image is a non-string type", async () => {
    setSessionData({
      user: { id: "user-123", email: "test@example.com", name: "Test", image: 42 },
    });

    const result = await readPersistedSession();

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

    const result = await readPersistedSession();

    expect(result).toBeNull();
  });
});
