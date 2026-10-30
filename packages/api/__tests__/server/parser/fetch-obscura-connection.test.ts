// @vitest-environment node
/**
 * Obscura's endpoint and token come from the Page Renderers setting, so a save in admin settings
 * reaches the next render without a restart: the cached connection is replaced when either changes.
 */
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PageRenderersConfig } from "@norish/config/zod/server-config";
import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { closeBrowsers } from "@norish/api/parser/browser-connections";
import { renderPage } from "@norish/api/parser/fetch";

const { connectOverCDP, log } = vi.hoisted(() => ({
  connectOverCDP: vi.fn(),
  log: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("playwright-core", () => ({ chromium: { connectOverCDP } }));

vi.mock("@norish/shared-server/logger", () => ({ parserLogger: log, serverLogger: log }));

let renderers: PageRenderersConfig;

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getPageRenderersConfig: async () => renderers,
}));

/** A connected Obscura whose every page renders `html`, navigating through `goto`. */
function fakeBrowser(
  html: string,
  goto: (url: string, options: { timeout?: number }) => Promise<unknown> = async () => undefined
) {
  return {
    isConnected: () => true,
    close: vi.fn().mockResolvedValue(undefined),
    newContext: vi.fn(async () => ({
      close: vi.fn().mockResolvedValue(undefined),
      newPage: vi.fn(async () => ({
        goto: vi.fn(goto),
        content: vi.fn().mockResolvedValue(html),
        evaluate: vi.fn(),
        on: vi.fn(),
        mainFrame: vi.fn(),
      })),
    })),
  };
}

beforeEach(async () => {
  await closeBrowsers();
  vi.clearAllMocks();
  connectOverCDP.mockReset();
  renderers = {
    obscura: { enabled: true, endpoint: "ws://obscura:9222", cdpToken: "first" },
    chromium: { enabled: false, endpoint: "" },
    solver: { enabled: false },
    allowPrivateAddresses: false,
    navigationTimeoutMs: 45_000,
  };
});

describe("renderPage – the Obscura connection follows the setting", () => {
  it("keeps one connection while the endpoint and token stay the same", async () => {
    connectOverCDP.mockResolvedValue(fakeBrowser("<html><head><title>one</title></head></html>"));

    await renderPage("https://example.com/a");
    await renderPage("https://example.com/b");

    expect(connectOverCDP).toHaveBeenCalledOnce();
    expect(connectOverCDP).toHaveBeenCalledWith("ws://obscura:9222", {
      headers: { Authorization: "Bearer first" },
      timeout: expect.any(Number),
    });
  });

  it("replaces the connection on the next render once the endpoint or token changes", async () => {
    const first = fakeBrowser("<html><head><title>first</title></head></html>");
    const second = fakeBrowser("<html><head><title>second</title></head></html>");
    const third = fakeBrowser("<html><head><title>third</title></head></html>");

    connectOverCDP
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
      .mockResolvedValueOnce(third);

    await renderPage("https://example.com/a");
    renderers.obscura.endpoint = "ws://browser.lan:9333";

    await expect(renderPage("https://example.com/a")).resolves.toMatchObject({
      html: "<html><head><title>second</title></head></html>",
    });
    renderers.obscura.cdpToken = "rotated";

    await expect(renderPage("https://example.com/a")).resolves.toMatchObject({
      html: "<html><head><title>third</title></head></html>",
    });
    expect(first.close).toHaveBeenCalled();
    expect(second.close).toHaveBeenCalled();
    expect(connectOverCDP).toHaveBeenLastCalledWith("ws://browser.lan:9333", {
      headers: { Authorization: "Bearer rotated" },
      timeout: expect.any(Number),
    });
  });
});

describe("renderPage – one deadline per attempt", () => {
  afterEach(() => vi.useRealTimers());

  it("connects and navigates within the navigation timeout, and settles within its own", async () => {
    vi.useFakeTimers();
    // Every edge takes 20 s and honours the timeout it is given, as Playwright's do.
    const slow = <T>(value: T, timeout = 0) =>
      new Promise<T>((resolve, reject) => {
        setTimeout(() => resolve(value), 20_000);
        if (timeout > 0) setTimeout(() => reject(new Error(`Timeout ${timeout}ms`)), timeout);
      });
    const browser = fakeBrowser("<html>still checking</html>", async (_url, { timeout }) =>
      slow(null, timeout)
    );
    const cookie: SiteAuthTokenDecryptedDto = {
      id: "00000000-0000-0000-0000-000000000000",
      userId: "user-1",
      domain: "example.com",
      name: "session",
      value: "s",
      type: "cookie",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    };

    connectOverCDP.mockImplementation(
      async (_endpoint: string, { timeout }: { timeout?: number }) => slow(browser, timeout)
    );
    renderers.navigationTimeoutMs = 30_000;

    const started = Date.now();
    const finished = renderPage("https://example.com/r", [cookie], () => false).then((page) => ({
      page,
      took: Date.now() - started,
    }));

    await vi.runAllTimersAsync();

    const { page, took } = await finished;

    // The navigation timeout, then the settle deadline of 15 s, and no stack of them.
    expect(took).toBeLessThanOrEqual(30_000 + 15_000);
    expect(page).toEqual({ html: "", status: null });
  });
});

describe("renderPage – an Obscura it cannot reach", () => {
  it("reads no HTML and logs the endpoint at error level, without its query string", async () => {
    renderers.obscura = { enabled: true, endpoint: "http://obscura:9222/?token=secret" };
    // Playwright names an http endpoint in its error, query string and all.
    connectOverCDP.mockRejectedValue(
      new Error(
        "browserType.connectOverCDP: connect ECONNREFUSED\nCall log:\n  - <ws preparing> retrieving websocket url from http://obscura:9222/?token=secret"
      )
    );

    await expect(renderPage("https://example.com/r")).resolves.toEqual({ html: "", status: null });
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ renderer: "obscura", endpoint: "http://obscura:9222/" }),
      expect.stringMatching(/not reachable at http:\/\/obscura:9222\/\. .*admin settings/)
    );

    const logged = Object.values(log).map((level) => level.mock.calls);

    expect(inspect(logged, { depth: null })).not.toContain("secret");
  });
});
