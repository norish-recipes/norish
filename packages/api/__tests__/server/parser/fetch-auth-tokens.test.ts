// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { fetchRenderedPage, headerScope, plainFetch } from "@norish/api/parser/fetch";

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

vi.mock("@norish/api/parser/browser-connections", () => ({
  getBrowser: mockGetBrowser,
}));

// Every host resolves to a public address, so no lookup leaves the process.
vi.mock("node:dns/promises", () => ({
  lookup: async () => [{ address: "93.184.215.14", family: 4 }],
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getPageRenderersConfig: async () => ({
    obscura: { enabled: true, endpoint: "ws://obscura:9222" },
    chromium: { enabled: false, endpoint: "" },
    solver: { enabled: false },
    allowPrivateAddresses: false,
    navigationTimeoutMs: 45_000,
  }),
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

/** The cookies the page sets, as `document.cookie` lines, and the URLs visited in order. */
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
      cookies: ["session_id=sess-abc; path=/; domain=example.com; secure"],
      visited: ["https://recipes.example.com/robots.txt", "https://recipes.example.com/page"],
    });

    // Cookie tokens never leak into the header set
    expect(getExtraHTTPHeaders()).toBeUndefined();
  });

  it("sends nothing for a token saved with a bare word for its domain", async () => {
    const tokens = [
      makeToken({ name: "sessionid", value: "s", type: "cookie", domain: "instagram" }),
      makeToken({ name: "Authorization", value: "Bearer s", type: "header", domain: "instagram" }),
    ];

    await fetchRenderedPage("https://www.instagram.com/reel/abc", tokens);

    expect(setFromPage()).toEqual({
      cookies: undefined,
      visited: ["https://www.instagram.com/reel/abc"],
    });
    expect(mockCdpSend).not.toHaveBeenCalled();
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
      "session=sess-123; path=/; domain=example.com; secure",
      "prefs=dark-mode; path=/; domain=example.com; secure",
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
      "token_a=val-a; path=/; domain=example.com; secure",
      "token_b=val-b; path=/; domain=example.com; secure",
      "token_c=val-c; path=/; domain=example.com; secure",
    ]);
  });

  it("sends an http page no tokens, so none cross the network in the clear", async () => {
    const tokens = [
      makeToken({ name: "session", value: "s", type: "cookie" }),
      makeToken({ name: "Authorization", value: "Bearer s", type: "header" }),
    ];

    await fetchRenderedPage("http://example.com/page", tokens);

    expect(setFromPage()).toEqual({ cookies: undefined, visited: ["http://example.com/page"] });
    expect(mockCdpSend).not.toHaveBeenCalled();
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

  it("keeps to the narrowest domain when tokens name several", () => {
    expect(scope("www.instagram.com", "instagram.com", "www.instagram.com")).toBe(
      "www.instagram.com"
    );
  });

  it("leaves out a domain the host is not on, a bare word included", () => {
    expect(scope("www.instagram.com", "instagram", "other.test", "instagram.com")).toBe(
      "instagram.com"
    );
  });
});

describe("plainFetch – Site Auth Tokens across redirects", () => {
  const tokens = [
    makeToken({ name: "Authorization", value: "Bearer abc123", type: "header" }),
    makeToken({ name: "session", value: "sess-abc", type: "cookie" }),
    makeToken({ name: "prefs", value: "dark", type: "cookie" }),
  ];

  /** Answers each request with the next reply, recording what each one carried. */
  function serve(...replies: Response[]) {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Promise.resolve(replies.shift() ?? new Response("", { status: 500 }))
    );

    vi.stubGlobal("fetch", fetchMock);

    return () =>
      fetchMock.mock.calls.map(([url, init]) => ({
        url,
        headers: init.headers,
        redirect: init.redirect,
      }));
  }

  const redirectTo = (location: string) =>
    new Response(null, { status: 302, headers: { location } });

  afterEach(() => vi.unstubAllGlobals());

  it("sends header and cookie tokens to a host on their domain", async () => {
    const requests = serve(redirectTo("/r/1?x=1"), new Response("<html>page</html>"));
    const sent = {
      headers: {
        "user-agent": "Norish",
        Authorization: "Bearer abc123",
        cookie: "session=sess-abc; prefs=dark",
      },
      redirect: "manual",
    };

    await expect(plainFetch("https://www.example.com/r/1", "Norish", { tokens })).resolves.toEqual({
      html: "<html>page</html>",
      status: 200,
      url: "https://www.example.com/r/1?x=1",
    });

    expect(requests()).toEqual([
      { url: "https://www.example.com/r/1", ...sent },
      { url: "https://www.example.com/r/1?x=1", ...sent },
    ]);
  });

  it("sends no token to the host a redirect points away to", async () => {
    const requests = serve(
      redirectTo("https://tracker.example.net/landing"),
      new Response("<html>elsewhere</html>")
    );

    await expect(
      plainFetch("https://example.com/r/1", "Norish", { tokens })
    ).resolves.toMatchObject({ url: "https://tracker.example.net/landing" });

    expect(requests()[1]).toEqual({
      url: "https://tracker.example.net/landing",
      headers: { "user-agent": "Norish" },
      redirect: "manual",
    });
  });

  it("sends no token over plain http, even after a downgrade on its own site", async () => {
    const requests = serve(redirectTo("http://example.com/r/1"), new Response(""));

    await plainFetch("https://example.com/r/1", "Norish", { tokens });
    await plainFetch("http://example.com/r/2", "Norish", { tokens });

    expect(requests().map(({ headers }) => headers)).toEqual([
      expect.objectContaining({ cookie: "session=sess-abc; prefs=dark" }),
      { "user-agent": "Norish" },
      { "user-agent": "Norish" },
    ]);
  });

  it("sends nothing for a token saved with a bare word for its domain", async () => {
    const requests = serve(new Response("<html>page</html>"));

    await plainFetch("https://www.instagram.com/p/1", "Norish", {
      tokens: [
        makeToken({
          name: "Authorization",
          value: "Bearer s",
          type: "header",
          domain: "instagram",
        }),
        makeToken({ name: "sessionid", value: "s", type: "cookie", domain: "instagram" }),
      ],
    });

    expect(requests()[0]?.headers).toEqual({ "user-agent": "Norish" });
  });

  it("sends nothing for a bare-word token to a host under a top-level domain of that name", async () => {
    const requests = serve(new Response("<html>page</html>"), new Response("<html>page</html>"));
    const bareWord = (domain: string) => [
      makeToken({ name: "Authorization", value: "Bearer s", type: "header", domain }),
      makeToken({ name: "sessionid", value: "s", type: "cookie", domain }),
    ];

    await plainFetch("https://attacker.shop/", "Norish", { tokens: bareWord("shop") });
    await plainFetch("https://instagram/p/1", "Norish", { tokens: bareWord("instagram") });

    expect(requests().map(({ headers }) => headers)).toEqual([
      { "user-agent": "Norish" },
      { "user-agent": "Norish" },
    ]);
  });

  it("does not take a host that merely ends in the token's domain for its site", async () => {
    const requests = serve(redirectTo("https://evilexample.com/"), new Response(""));

    await plainFetch("https://example.com/r/1", "Norish", { tokens });

    expect(requests()[1]?.headers).toEqual({ "user-agent": "Norish" });
  });

  it("refuses links and redirects that are not web pages", async () => {
    const requests = serve(redirectTo("file:///etc/passwd"));

    await expect(plainFetch("gopher://127.0.0.1:6379/_x", "Norish")).resolves.toMatchObject({
      html: "",
      status: null,
    });
    await expect(plainFetch("https://example.com/r/1", "Norish")).resolves.toMatchObject({
      html: "",
      status: null,
    });
    expect(requests().map(({ url }) => url)).toEqual(["https://example.com/r/1"]);
  });

  it("gives up on a redirect loop", async () => {
    const requests = serve(...Array.from({ length: 20 }, () => redirectTo("/again")));

    await expect(plainFetch("https://example.com/r/1", "Norish")).resolves.toMatchObject({
      html: "",
      status: null,
    });
    expect(requests()).toHaveLength(11);
  });

  it("hands back no HTML for an error page, with its status", async () => {
    serve(new Response("<html>denied</html>", { status: 403 }));

    await expect(plainFetch("https://example.com/r/1", "Norish")).resolves.toEqual({
      html: "",
      status: 403,
      url: "https://example.com/r/1",
    });
  });
});
