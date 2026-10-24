// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { fetchRenderedPage, headerScope } from "@norish/api/parser/fetch";

// ---------------------------------------------------------------------------
// Obscura is reached through Playwright; the browser object stays mocked so
// these tests describe what Norish injects, not how Obscura applies it.
// ---------------------------------------------------------------------------
const { mockAddCookies, mockCdpSend, mockEvaluate, mockGoto, mockNewContext, mockGetBrowser } =
  vi.hoisted(() => {
    const mockAddCookies = vi.fn();
    // Norish's Obscura echoes the scope it applied.
    const mockCdpSend = vi.fn(async (_method: string, params: { scopeDomain?: string }) =>
      params.scopeDomain ? { scopeDomain: params.scopeDomain } : {}
    );
    const mockEvaluate = vi.fn().mockResolvedValue(undefined);
    const mockGoto = vi.fn().mockResolvedValue(undefined);
    const mockContent = vi.fn().mockResolvedValue("<html>test</html>");
    const mockClose = vi.fn().mockResolvedValue(undefined);
    const mockNewPage = vi.fn();
    const mockNewContext = vi.fn().mockImplementation(async () => ({
      addCookies: mockAddCookies,
      newCDPSession: vi.fn().mockResolvedValue({ send: mockCdpSend }),
      newPage: mockNewPage.mockResolvedValue({
        goto: mockGoto,
        content: mockContent,
        evaluate: mockEvaluate,
        on: vi.fn(),
        mainFrame: vi.fn(),
      }),
      close: mockClose,
    }));
    const mockGetBrowser = vi.fn().mockResolvedValue({
      newContext: mockNewContext,
    });

    return {
      mockAddCookies,
      mockCdpSend,
      mockEvaluate,
      mockGoto,
      mockNewContext,
      mockGetBrowser,
    };
  });

vi.mock("@norish/api/obscura", () => ({
  getBrowser: mockGetBrowser,
}));

vi.mock("@norish/shared-server/logger", () => ({
  parserLogger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

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
    { extraHTTPHeaders?: Record<string, string> } | undefined;

  return arg?.extraHTTPHeaders;
}

/** The cookies set from the page, as `{ name, value }`, and the URLs visited in order. */
function setFromPage(): { cookies: unknown; visited: string[] } {
  return {
    cookies: mockEvaluate.mock.calls[0]?.[1],
    visited: mockGoto.mock.calls.map((call) => call[0] as string),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => vi.clearAllMocks());

describe("fetchRenderedPage – auth token injection", () => {
  it("sends no headers at all when no tokens are provided", async () => {
    await fetchRenderedPage("https://example.com/recipe");

    // Obscura owns the browser identity, so a fetch with nothing to inject
    // customises nothing.
    expect(getExtraHTTPHeaders()).toBeUndefined();

    expect(setFromPage()).toEqual({ cookies: undefined, visited: ["https://example.com/recipe"] });
  });

  it("sends no headers at all when tokens is undefined", async () => {
    await fetchRenderedPage("https://example.com/recipe", undefined);

    expect(getExtraHTTPHeaders()).toBeUndefined();

    expect(setFromPage()).toEqual({ cookies: undefined, visited: ["https://example.com/recipe"] });
  });

  it("sends header tokens to their own site only, through Obscura's scopeDomain", async () => {
    const tokens = [
      makeToken({ name: "Authorization", value: "Bearer abc123", type: "header" }),
      makeToken({ name: "X-Custom", value: "custom-val", type: "header" }),
    ];

    await fetchRenderedPage("https://www.example.com/recipe", tokens);

    expect(mockCdpSend.mock.calls).toEqual([
      [
        "Network.setExtraHTTPHeaders",
        {
          headers: { Authorization: "Bearer abc123", "X-Custom": "custom-val" },
          scopeDomain: "example.com",
        },
      ],
    ]);
    // Never through the context, which would send them to every host.
    expect(getExtraHTTPHeaders()).toBeUndefined();
    expect(mockEvaluate).not.toHaveBeenCalled();
  });

  it("clears header tokens again on an Obscura that doesn't echo the scope", async () => {
    mockCdpSend.mockResolvedValueOnce({});

    await fetchRenderedPage("https://example.com/recipe", [
      makeToken({ name: "Authorization", value: "Bearer abc123", type: "header" }),
    ]);

    expect(mockCdpSend.mock.calls.at(-1)).toEqual(["Network.setExtraHTTPHeaders", { headers: {} }]);
  });

  it("sets cookie tokens from the target's own origin, whose jar sends them to that host only", async () => {
    const tokens = [makeToken({ name: "session_id", value: "sess-abc", type: "cookie" })];

    await fetchRenderedPage("https://recipes.example.com/page", tokens);

    // Obscura drops cookies set over CDP, so none go through addCookies.
    expect(mockAddCookies).not.toHaveBeenCalled();
    expect(setFromPage()).toEqual({
      cookies: [{ name: "session_id", value: "sess-abc", domain: "example.com" }],
      visited: ["https://recipes.example.com/robots.txt", "https://recipes.example.com/page"],
    });

    // Cookie tokens never leak into the header set
    expect(getExtraHTTPHeaders()).toBeUndefined();
  });

  it("keeps a cookie whose domain is a bare word on the target host alone", async () => {
    const tokens = [
      makeToken({ name: "sessionid", value: "s", type: "cookie", domain: "instagram" }),
    ];

    await fetchRenderedPage("https://www.instagram.com/reel/abc", tokens);

    expect(setFromPage().cookies).toEqual([{ name: "sessionid", value: "s", domain: null }]);
  });

  it("handles mixed header and cookie tokens", async () => {
    const tokens = [
      makeToken({ name: "Authorization", value: "Bearer xyz", type: "header" }),
      makeToken({ name: "session", value: "sess-123", type: "cookie" }),
      makeToken({ name: "X-Api-Key", value: "key-456", type: "header" }),
      makeToken({ name: "prefs", value: "dark-mode", type: "cookie" }),
    ];

    await fetchRenderedPage("https://food.example.com/r/1", tokens);

    expect(getExtraHTTPHeaders()).toBeUndefined();

    expect(setFromPage().cookies).toEqual([
      { name: "session", value: "sess-123", domain: "example.com" },
      { name: "prefs", value: "dark-mode", domain: "example.com" },
    ]);
  });

  it("adds multiple cookie tokens for the same domain", async () => {
    const tokens = [
      makeToken({ name: "token_a", value: "val-a", type: "cookie" }),
      makeToken({ name: "token_b", value: "val-b", type: "cookie" }),
      makeToken({ name: "token_c", value: "val-c", type: "cookie" }),
    ];

    await fetchRenderedPage("https://example.com/page", tokens);

    expect(mockEvaluate).toHaveBeenCalledOnce();
    expect(setFromPage().cookies).toEqual([
      { name: "token_a", value: "val-a", domain: "example.com" },
      { name: "token_b", value: "val-b", domain: "example.com" },
      { name: "token_c", value: "val-c", domain: "example.com" },
    ]);
  });
});

describe("headerScope", () => {
  const scope = (hostname: string, ...domains: string[]) =>
    headerScope(
      hostname,
      domains.map((domain) => makeToken({ name: "X", value: "v", type: "header", domain }))
    );

  it("takes a token's domain when the host is on it", () => {
    expect(scope("www.example.com", "example.com")).toBe("example.com");
  });

  it("widens a bare word to the host's labels from that word on", () => {
    expect(scope("www.instagram.com", "instagram")).toBe("instagram.com");
  });

  it("keeps to the narrowest domain when tokens name several", () => {
    expect(scope("www.instagram.com", "instagram.com", "www.instagram.com")).toBe(
      "www.instagram.com"
    );
  });

  it("falls back to the host itself for a domain it is not on", () => {
    expect(scope("example.com", "other.test")).toBe("example.com");
  });
});
