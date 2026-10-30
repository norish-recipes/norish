// @vitest-environment node
/**
 * The rendered-page contract Norish owns on top of Obscura: one isolated
 * context per fetch, one navigation under one deadline, the returned HTML, and
 * cleanup whichever way the fetch ends.
 *
 * Obscura owns everything this file deliberately does not assert — the browser
 * identity, page settling, stealth and tracker blocking. Norish used to
 * manufacture a Windows Chrome fingerprint and a coin-flip referer on top of
 * those; two browser identities disagreeing is worse than either alone, so the
 * absence of Norish-authored identity is pinned here as behaviour.
 *
 * The one thing Norish does add is the caller's own reading of whether the
 * rendered page is the page it asked for: a shop's bot check and a shop's
 * empty results page are the same two kilobytes to everybody else.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PageRenderersConfig } from "@norish/config/zod/server-config";
import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { fetchRenderedPage, renderPage } from "@norish/api/parser/fetch";

const { mockGetBrowser, mockNewContext, mockNewPage, mockGoto, mockContent, mockClose } =
  vi.hoisted(() => {
    const mockGoto = vi.fn();
    const mockContent = vi.fn();
    const mockClose = vi.fn();
    const mockNewPage = vi.fn();
    const mockNewContext = vi.fn();
    const mockGetBrowser = vi.fn();

    return { mockGetBrowser, mockNewContext, mockNewPage, mockGoto, mockContent, mockClose };
  });

vi.mock("@norish/api/parser/browser-connections", () => ({ getBrowser: mockGetBrowser }));

let renderers: PageRenderersConfig;

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getPageRenderersConfig: async () => renderers,
}));

vi.mock("@norish/shared-server/logger", () => ({
  parserLogger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const mainFrame = { name: "main" };
let responseListeners: ((response: unknown) => void)[] = [];

/** A response as Playwright reports it: its status, the frame, and whether it is a navigation. */
function fakeResponse(status: number, options: { frame?: object; navigation?: boolean } = {}) {
  return {
    status: () => status,
    frame: () => options.frame ?? mainFrame,
    request: () => ({ isNavigationRequest: () => options.navigation ?? true }),
  };
}

/** Deliver a response to the page's `response` listeners, as the browser would. */
function emitResponse(response: ReturnType<typeof fakeResponse>): void {
  for (const listener of responseListeners) listener(response);
}

/** The options Norish passed to `browser.newContext()` for the nth fetch. */
function contextOptions(call = 0): Record<string, unknown> {
  return (mockNewContext.mock.calls[call]?.[0] as Record<string, unknown> | undefined) ?? {};
}

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

beforeEach(() => {
  renderers = {
    obscura: { enabled: true, endpoint: "ws://obscura:9222", cdpToken: "cdp-token" },
    chromium: { enabled: false, endpoint: "" },
    solver: { enabled: false },
    allowPrivateAddresses: false,
    navigationTimeoutMs: 30_000,
  };
  mockGetBrowser.mockClear();
  mockGoto.mockResolvedValue(undefined);
  mockContent.mockResolvedValue("<html><head><title>Rendered</title></head></html>");
  mockClose.mockResolvedValue(undefined);
  responseListeners = [];
  mockNewPage.mockResolvedValue({
    goto: mockGoto,
    content: mockContent,
    mainFrame: () => mainFrame,
    on: (_event: string, listener: (response: unknown) => void) => {
      responseListeners.push(listener);
    },
  });
  mockNewContext.mockImplementation(async () => ({
    addCookies: vi.fn(),
    newCDPSession: vi.fn().mockResolvedValue({
      send: vi.fn(async (_method: string, params: { scopeDomain?: string }) => ({
        scopeDomain: params.scopeDomain,
      })),
    }),
    newPage: mockNewPage,
    close: mockClose,
  }));
  mockGetBrowser.mockResolvedValue({ newContext: mockNewContext });
});

afterEach(() => vi.useRealTimers());

describe("fetchRenderedPage – rendered-page contract", () => {
  it("never hands the browser a link that is not a web page", async () => {
    mockGetBrowser.mockClear();
    for (const url of ["file:///etc/passwd", "gopher://127.0.0.1:6379/_x", "not a link"]) {
      await expect(renderPage(url), url).resolves.toEqual({ html: "", status: null });
    }

    expect(mockGetBrowser).not.toHaveBeenCalled();
  });

  it("returns the HTML Obscura rendered", async () => {
    await expect(fetchRenderedPage("https://example.com/recipe")).resolves.toBe(
      "<html><head><title>Rendered</title></head></html>"
    );
  });

  it("gives every fetch its own isolated context and closes it", async () => {
    await fetchRenderedPage("https://example.com/one");
    await fetchRenderedPage("https://example.com/two");

    expect(mockNewContext).toHaveBeenCalledTimes(2);
    expect(mockClose).toHaveBeenCalledTimes(2);
  });

  it("navigates once, under one bounded deadline", async () => {
    // Held still, so none of the deadline is used up on the way to the navigation.
    vi.useFakeTimers({ toFake: ["Date"] });
    await fetchRenderedPage("https://example.com/recipe");

    expect(mockGoto).toHaveBeenCalledOnce();

    const [url, options] = mockGoto.mock.calls[0] as [string, { timeout?: number }];

    expect(url).toBe("https://example.com/recipe");
    expect(options.timeout).toBe(30_000);
  });

  it("dials the Obscura endpoint and token the administrator saved", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await fetchRenderedPage("https://example.com/recipe");

    expect(mockGetBrowser).toHaveBeenCalledWith(
      "obscura",
      "ws://obscura:9222",
      "cdp-token",
      30_000
    );
  });

  it("reports no HTML without dialling Obscura when it is switched off", async () => {
    renderers.obscura.enabled = false;

    await expect(renderPage("https://example.com/recipe")).resolves.toEqual({
      html: "",
      status: null,
    });
    expect(mockGetBrowser).not.toHaveBeenCalled();
  });

  it("supplies no browser identity of its own", async () => {
    await fetchRenderedPage("https://example.com/recipe");

    // Not "no user-agent, no viewport, no locale" one key at a time: the point
    // is that Norish configures nothing here at all, so a header added back
    // later fails this rather than slipping past a fixed deny-list.
    expect(contextOptions()).toEqual({});
  });

  it("configures the context with nothing, header tokens included: they go to the page only", async () => {
    await expect(
      fetchRenderedPage("https://example.com/recipe", [
        makeToken({ name: "Authorization", value: "Bearer abc123", type: "header" }),
      ])
    ).resolves.toBe("<html><head><title>Rendered</title></head></html>");

    expect(contextOptions()).toEqual({});
  });

  it("reads the page once when the caller has no reading of its own", async () => {
    await fetchRenderedPage("https://example.com/recipe");

    expect(mockContent).toHaveBeenCalledOnce();
  });

  it("waits for a page that answered with a bot check to become itself", async () => {
    mockContent
      .mockResolvedValueOnce("<html>a bot check</html>")
      .mockResolvedValue("<html><head><title>the shop</title></head></html>");

    await expect(
      fetchRenderedPage("https://example.com/zoeken", undefined, (html) =>
        html.includes("the shop")
      )
    ).resolves.toBe("<html><head><title>the shop</title></head></html>");
  });

  it("counts a page it cannot read mid-navigation as one still becoming itself", async () => {
    mockContent
      .mockRejectedValueOnce(new Error("the page is navigating and changing the content"))
      .mockResolvedValue("<html><head><title>the shop</title></head></html>");

    await expect(
      fetchRenderedPage("https://example.com/zoeken", undefined, (html) =>
        html.includes("the shop")
      )
    ).resolves.toBe("<html><head><title>the shop</title></head></html>");
  });

  it("closes the context when navigation fails, and reports no HTML", async () => {
    mockGoto.mockRejectedValue(new Error("net::ERR_ABORTED"));

    await expect(fetchRenderedPage("https://example.com/recipe")).resolves.toBe("");
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it("reports no HTML when Obscura is unreachable", async () => {
    mockGetBrowser.mockResolvedValue(null);

    await expect(fetchRenderedPage("https://example.com/recipe")).resolves.toBe("");
    expect(mockNewContext).not.toHaveBeenCalled();
  });

  it("survives a context that fails to close", async () => {
    mockClose.mockRejectedValue(new Error("context already gone"));

    await expect(fetchRenderedPage("https://example.com/recipe")).resolves.toBe(
      "<html><head><title>Rendered</title></head></html>"
    );
  });
});

describe("renderPage – the status a site answered with", () => {
  it("reports a refused document's status, with no HTML", async () => {
    mockGoto.mockResolvedValue(fakeResponse(403));

    await expect(renderPage("https://example.com/recipe")).resolves.toEqual({
      html: "",
      status: 403,
    });
  });

  it("reads the real page when a bot check answers 403 first", async () => {
    mockGoto.mockImplementation(async () => {
      emitResponse(fakeResponse(403));
      emitResponse(fakeResponse(200));

      return fakeResponse(403);
    });

    await expect(renderPage("https://example.com/recipe")).resolves.toEqual({
      html: "<html><head><title>Rendered</title></head></html>",
      status: 200,
    });
  });

  it("ignores images, scripts and frames inside the page", async () => {
    mockGoto.mockImplementation(async () => {
      emitResponse(fakeResponse(403));
      emitResponse(fakeResponse(200, { navigation: false }));
      emitResponse(fakeResponse(200, { frame: { name: "ad" } }));

      return fakeResponse(403);
    });

    await expect(renderPage("https://example.com/recipe")).resolves.toMatchObject({
      status: 403,
    });
  });

  it("reports no status when there was no answer at all", async () => {
    mockGoto.mockRejectedValue(new Error("net::ERR_NAME_NOT_RESOLVED"));

    await expect(renderPage("https://example.com/recipe")).resolves.toEqual({
      html: "",
      status: null,
    });
  });
});
