// @vitest-environment node
import type { SiteAuthTokenDecryptedDto } from "@/types/dto/site-auth-tokens";

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Playwright mocks – declared via vi.hoisted() so they are available inside
// the hoisted vi.mock() factory functions.
// ---------------------------------------------------------------------------
const { mockAddCookies, mockNewContext, mockGetBrowser } = vi.hoisted(() => {
  const mockAddCookies = vi.fn();
  const mockGoto = vi.fn().mockResolvedValue(undefined);
  const mockContent = vi.fn().mockResolvedValue("<html>test</html>");
  const mockTitle = vi.fn().mockResolvedValue("Test Page");
  const mockLocator = vi.fn().mockReturnValue({
    count: vi.fn().mockResolvedValue(0),
    first: vi.fn().mockReturnValue({
      waitFor: vi.fn().mockRejectedValue(new Error("timeout")),
    }),
  });
  const mockWaitForLoadState = vi.fn().mockResolvedValue(undefined);
  const mockWaitForFunction = vi.fn().mockResolvedValue(undefined);
  const mockClose = vi.fn().mockResolvedValue(undefined);
  const mockNewPage = vi.fn();
  const mockNewContext = vi.fn().mockImplementation(async () => ({
    addCookies: mockAddCookies,
    newPage: mockNewPage.mockResolvedValue({
      goto: mockGoto,
      content: mockContent,
      title: mockTitle,
      locator: mockLocator,
      waitForLoadState: mockWaitForLoadState,
      waitForFunction: mockWaitForFunction,
    }),
    close: mockClose,
  }));
  const mockGetBrowser = vi.fn().mockResolvedValue({
    newContext: mockNewContext,
  });

  return {
    mockAddCookies,
    mockNewContext,
    mockGetBrowser,
  };
});

vi.mock("@/server/playwright", () => ({
  getBrowser: mockGetBrowser,
}));

vi.mock("@/server/logger", () => ({
  parserLogger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { fetchViaPlaywright } from "@/server/parser/fetch";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeToken(
  overrides: Partial<SiteAuthTokenDecryptedDto> & {
    name: string;
    value: string;
    type: "header" | "cookie";
  }
): SiteAuthTokenDecryptedDto {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    userId: "user-1",
    domain: "example.com",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

/** Extract the `extraHTTPHeaders` passed to `browser.newContext()`. */
function getExtraHTTPHeaders(): Record<string, string> | undefined {
  const arg = mockNewContext.mock.calls[0]?.[0] as
    | { extraHTTPHeaders?: Record<string, string> }
    | undefined;

  return arg?.extraHTTPHeaders;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("fetchViaPlaywright – auth token injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not inject auth headers or cookies when no tokens are provided", async () => {
    await fetchViaPlaywright("https://example.com/recipe");

    const headers = getExtraHTTPHeaders()!;

    // Should still contain default browser headers but no custom auth ones
    expect(headers).toBeDefined();
    expect(headers).toHaveProperty("DNT");
    expect(headers).toHaveProperty("Referer");

    expect(mockAddCookies).not.toHaveBeenCalled();
  });

  it("does not inject auth headers or cookies when tokens is undefined", async () => {
    await fetchViaPlaywright("https://example.com/recipe", undefined);

    const headers = getExtraHTTPHeaders()!;

    expect(headers).toBeDefined();
    expect(headers).toHaveProperty("DNT");

    expect(mockAddCookies).not.toHaveBeenCalled();
  });

  it("merges header tokens into extraHTTPHeaders", async () => {
    const tokens = [
      makeToken({ name: "Authorization", value: "Bearer abc123", type: "header" }),
      makeToken({ name: "X-Custom", value: "custom-val", type: "header" }),
    ];

    await fetchViaPlaywright("https://example.com/recipe", tokens);

    const headers = getExtraHTTPHeaders()!;

    expect(headers["Authorization"]).toBe("Bearer abc123");
    expect(headers["X-Custom"]).toBe("custom-val");

    // Default headers should still be present
    expect(headers).toHaveProperty("DNT", "1");

    // No cookies to add
    expect(mockAddCookies).not.toHaveBeenCalled();
  });

  it("injects cookie tokens via context.addCookies with correct domain and path", async () => {
    const tokens = [makeToken({ name: "session_id", value: "sess-abc", type: "cookie" })];

    await fetchViaPlaywright("https://recipes.example.com/page", tokens);

    expect(mockAddCookies).toHaveBeenCalledOnce();
    expect(mockAddCookies).toHaveBeenCalledWith([
      {
        name: "session_id",
        value: "sess-abc",
        domain: "recipes.example.com",
        path: "/",
      },
    ]);

    // No extra auth headers beyond defaults
    const headers = getExtraHTTPHeaders()!;

    expect(headers).not.toHaveProperty("session_id");
  });

  it("handles mixed header and cookie tokens", async () => {
    const tokens = [
      makeToken({ name: "Authorization", value: "Bearer xyz", type: "header" }),
      makeToken({ name: "session", value: "sess-123", type: "cookie" }),
      makeToken({ name: "X-Api-Key", value: "key-456", type: "header" }),
      makeToken({ name: "prefs", value: "dark-mode", type: "cookie" }),
    ];

    await fetchViaPlaywright("https://food.example.org/r/1", tokens);

    // Verify header tokens merged
    const headers = getExtraHTTPHeaders()!;

    expect(headers["Authorization"]).toBe("Bearer xyz");
    expect(headers["X-Api-Key"]).toBe("key-456");

    // Verify cookie tokens injected
    expect(mockAddCookies).toHaveBeenCalledOnce();
    expect(mockAddCookies).toHaveBeenCalledWith([
      { name: "session", value: "sess-123", domain: "food.example.org", path: "/" },
      { name: "prefs", value: "dark-mode", domain: "food.example.org", path: "/" },
    ]);
  });

  it("adds multiple cookie tokens for the same domain", async () => {
    const tokens = [
      makeToken({ name: "token_a", value: "val-a", type: "cookie" }),
      makeToken({ name: "token_b", value: "val-b", type: "cookie" }),
      makeToken({ name: "token_c", value: "val-c", type: "cookie" }),
    ];

    await fetchViaPlaywright("https://example.com/page", tokens);

    expect(mockAddCookies).toHaveBeenCalledOnce();
    const cookies = mockAddCookies.mock.calls[0][0] as Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
    }>;

    expect(cookies).toHaveLength(3);
    expect(cookies).toEqual([
      { name: "token_a", value: "val-a", domain: "example.com", path: "/" },
      { name: "token_b", value: "val-b", domain: "example.com", path: "/" },
      { name: "token_c", value: "val-c", domain: "example.com", path: "/" },
    ]);
  });
});
