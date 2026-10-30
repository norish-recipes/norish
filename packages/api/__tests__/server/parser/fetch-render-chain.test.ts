// @vitest-environment node
/**
 * The Page Renderer chain behind `renderPage` (ADR-0019): Obscura first, then the Chromium browser,
 * then a FlareSolverr-compatible solver, moving on only on no HTML or a bot check. Site Auth Tokens
 * never reach the solver. The browsers' connections, DNS and the solver's HTTP endpoint are faked
 * at the process edge.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BrowserRenderer } from "@norish/api/parser/browser-connections";
import type { PageRenderersConfig } from "@norish/config/zod/server-config";
import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { renderPage } from "@norish/api/parser/fetch";

const { mockGetBrowser, mockContent, mockCdpSend, log } = vi.hoisted(() => ({
  mockGetBrowser: vi.fn(),
  mockContent: vi.fn(),
  mockCdpSend: vi.fn(),
  log: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@norish/api/parser/browser-connections", () => ({ getBrowser: mockGetBrowser }));
vi.mock("@norish/shared-server/logger", () => ({ parserLogger: log }));
// Every host is public.
vi.mock("node:dns/promises", () => ({
  lookup: async () => [{ address: "93.184.215.14", family: 4 }],
}));

let renderers: PageRenderersConfig;
/** The status Obscura's page answers with. */
let documentStatus: number;
/** What the Chromium browser's page shows once loaded, or null for a browser it cannot reach. */
let chromiumPage: { html: string; status: number } | null;

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getPageRenderersConfig: async () => renderers,
}));

const padding = "x".repeat(30_000);
const REAL_PAGE = `<html><head><title>Lasagne</title></head><body>${padding}</body></html>`;
const SOLVED_PAGE = `<html><head><title>Lasagne, solved</title></head><body>${padding}</body></html>`;
const CHROMIUM_PAGE = `<html><head><title>Lasagne, in Chromium</title></head><body>${padding}</body></html>`;
const CHALLENGE = `<html><head><title>Just a moment...</title></head><body>${padding}</body></html>`;
/** Akamai's block page, which Obscura gets with a 200. */
const AKAMAI_BLOCK = `<HTML><HEAD>
<TITLE>Access Denied</TITLE>
</HEAD><BODY>
<H1>Access Denied</H1>
You don't have permission to access "http&#58;&#47;&#47;www&#46;ah&#46;nl&#47;allerhande&#47;recept&#47;R&#45;R1199735" on this server.<P>
Reference&#32;&#35;18&#46;5e3c1302&#46;1761400000&#46;1a2b3c4d
</BODY>
</HTML>`;
const SOLVER = "http://flaresolverr:8191/v1";

const TOKENS: SiteAuthTokenDecryptedDto[] = [
  { name: "Authorization", value: "Bearer abc", type: "header" },
  { name: "session", value: "sess-abc", type: "cookie" },
].map((token) => ({
  ...token,
  type: token.type as "header" | "cookie",
  id: "00000000-0000-0000-0000-000000000000",
  userId: "user-1",
  domain: "example.com",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
}));

/** The solver's endpoint, answering every request with `reply`; returns the bodies it was sent. */
function solverAnswers(reply: () => Promise<Response>) {
  const solver = vi.fn(async (_url: string, _init: RequestInit) => reply());

  vi.stubGlobal("fetch", solver);

  return {
    solver,
    sent: () =>
      solver.mock.calls.map(([url, init]) => ({
        url,
        method: init.method,
        body: JSON.parse(String(init.body)) as unknown,
      })),
  };
}

const solved = (html: string) => async () =>
  Response.json({ status: "ok", message: "", solution: { status: 200, response: html } });

/** Which renderer the log says answered. */
function answeredBy(): unknown[] {
  return log.info.mock.calls
    .filter(([, message]) => message === "A Page Renderer read the page")
    .map(([fields]) => (fields as { renderer: string }).renderer);
}

/** A browser whose every page is `page`, its document loaded. */
function chromiumShowing(page: { html: string; status: number }) {
  return {
    newContext: async () => ({
      close: async () => undefined,
      newCDPSession: async () => ({ on: vi.fn(), send: vi.fn() }),
      newPage: async () => ({
        goto: async () => ({ status: () => page.status }),
        // Run in the page against its loaded document, as the browser runs it.
        evaluate: async (read: () => unknown) => {
          vi.stubGlobal("document", {
            readyState: "complete",
            documentElement: { outerHTML: page.html },
          });

          return read();
        },
        on: vi.fn(),
        mainFrame: vi.fn(),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  renderers = {
    obscura: { enabled: true, endpoint: "ws://obscura:9222" },
    chromium: { enabled: false, endpoint: "http://chromium:9222" },
    solver: { enabled: true, endpoint: SOLVER },
    allowPrivateAddresses: false,
    navigationTimeoutMs: 30_000,
  };
  documentStatus = 200;
  mockContent.mockResolvedValue(REAL_PAGE);
  mockCdpSend.mockImplementation(async (_method: string, params: { scopeDomain?: string }) => ({
    scopeDomain: params.scopeDomain,
  }));
  chromiumPage = { html: CHROMIUM_PAGE, status: 200 };
  const obscura = {
    newContext: async () => ({
      newCDPSession: async () => ({ send: mockCdpSend }),
      close: async () => undefined,
      newPage: async () => ({
        goto: vi.fn(async () => ({ status: () => documentStatus })),
        content: mockContent,
        evaluate: vi.fn(),
        on: vi.fn(),
        mainFrame: vi.fn(),
      }),
    }),
  };

  mockGetBrowser.mockImplementation(async (renderer: BrowserRenderer) =>
    renderer === "obscura" ? obscura : chromiumPage && chromiumShowing(chromiumPage)
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("renderPage – the order", () => {
  it("stops at Obscura when Obscura reads the page", async () => {
    const { solver } = solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r")).resolves.toEqual({
      html: REAL_PAGE,
      status: 200,
    });
    expect(solver).not.toHaveBeenCalled();
    expect(answeredBy()).toEqual(["obscura"]);
  });

  it.each([401, 403, 429])(
    "moves on to the solver when Obscura's page answered %i",
    async (status) => {
      documentStatus = status;
      solverAnswers(solved(SOLVED_PAGE));

      await expect(renderPage("https://example.com/r")).resolves.toEqual({
        html: SOLVED_PAGE,
        status: null,
      });
      expect(answeredBy()).toEqual(["solver"]);
    }
  );

  it("moves on to the solver when Obscura is shown Akamai's block page with a 200", async () => {
    mockContent.mockResolvedValue(AKAMAI_BLOCK);
    solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r")).resolves.toEqual({
      html: SOLVED_PAGE,
      status: null,
    });
    expect(answeredBy()).toEqual(["solver"]);
  });

  it("moves on to the solver when Obscura returns no HTML", async () => {
    mockGetBrowser.mockResolvedValue(null);
    solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r")).resolves.toEqual({
      html: SOLVED_PAGE,
      status: null,
    });
    expect(answeredBy()).toEqual(["solver"]);
  });

  it("moves on to the solver when Obscura is shown a bot check", async () => {
    mockContent.mockResolvedValue(CHALLENGE);
    solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r")).resolves.toEqual({
      html: SOLVED_PAGE,
      status: null,
    });
  });

  it("reads nothing when the solver does no better, so the import fails as unreadable", async () => {
    documentStatus = 403;
    mockContent.mockResolvedValue(CHALLENGE);
    solverAnswers(solved(CHALLENGE));

    await expect(renderPage("https://example.com/r")).resolves.toEqual({
      html: "",
      status: 403,
    });
    expect(answeredBy()).toEqual([]);
  });
});

describe("renderPage – each renderer alone", () => {
  it("asks only the solver when Obscura is off", async () => {
    renderers.obscura.enabled = false;
    const { sent } = solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r")).resolves.toMatchObject({
      html: SOLVED_PAGE,
    });
    expect(mockGetBrowser).not.toHaveBeenCalled();
    expect(sent()).toEqual([
      {
        url: SOLVER,
        method: "POST",
        body: { cmd: "request.get", url: "https://example.com/r", maxTimeout: 30_000 },
      },
    ]);
  });

  it("asks only Obscura when the solver is off", async () => {
    renderers.solver.enabled = false;
    mockContent.mockResolvedValue(CHALLENGE);
    const { solver } = solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r")).resolves.toMatchObject({ html: "" });
    expect(solver).not.toHaveBeenCalled();
  });

  it("reads nothing with both off", async () => {
    renderers.obscura.enabled = false;
    renderers.solver.enabled = false;
    const { solver } = solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r")).resolves.toEqual({ html: "", status: null });
    expect(mockGetBrowser).not.toHaveBeenCalled();
    expect(solver).not.toHaveBeenCalled();
  });
});

describe("renderPage – the Chromium browser between Obscura and the solver", () => {
  beforeEach(() => {
    renderers.chromium.enabled = true;
  });

  afterEach(() => vi.useRealTimers());

  /** The render, with the clock run past the Chromium browser's wait for a bot check to clear. */
  async function pastTheSettleWait<T>(render: () => Promise<T>): Promise<T> {
    vi.useFakeTimers();
    const rendering = render();

    await vi.runAllTimersAsync();

    return rendering;
  }

  it("reads the page Obscura is shown Akamai's block page for, and stops there", async () => {
    mockContent.mockResolvedValue(AKAMAI_BLOCK);
    const { solver } = solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r")).resolves.toEqual({
      html: CHROMIUM_PAGE,
      status: 200,
    });
    expect(solver).not.toHaveBeenCalled();
    expect(answeredBy()).toEqual(["chromium"]);
  });

  it("is not asked when Obscura reads the page", async () => {
    solverAnswers(solved(SOLVED_PAGE));

    await renderPage("https://example.com/r");

    expect(mockGetBrowser.mock.calls.map(([renderer]) => renderer)).toEqual(["obscura"]);
  });

  it.each([
    ["is refused", { html: CHROMIUM_PAGE, status: 403 }],
    ["is shown a bot check", { html: CHALLENGE, status: 403 }],
    ["cannot be reached", null],
  ])("moves on to the solver when it %s", async (_case, page) => {
    mockContent.mockResolvedValue(CHALLENGE);
    chromiumPage = page;
    solverAnswers(solved(SOLVED_PAGE));

    await expect(pastTheSettleWait(() => renderPage("https://example.com/r"))).resolves.toEqual({
      html: SOLVED_PAGE,
      status: null,
    });
    expect(answeredBy()).toEqual(["solver"]);
  });

  it("reads nothing when every renderer fails, keeping the last status a site answered with", async () => {
    documentStatus = 429;
    mockContent.mockResolvedValue(CHALLENGE);
    chromiumPage = { html: CHALLENGE, status: 403 };
    solverAnswers(solved(CHALLENGE));

    await expect(pastTheSettleWait(() => renderPage("https://example.com/r"))).resolves.toEqual({
      html: "",
      status: 403,
    });
    expect(answeredBy()).toEqual([]);
  });

  it("is asked alone when Obscura and the solver are off", async () => {
    renderers.obscura.enabled = false;
    renderers.solver.enabled = false;
    const { solver } = solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r")).resolves.toEqual({
      html: CHROMIUM_PAGE,
      status: 200,
    });
    expect(mockGetBrowser.mock.calls.map(([renderer]) => renderer)).toEqual(["chromium"]);
    expect(solver).not.toHaveBeenCalled();
  });

  it("follows Obscura with the solver off", async () => {
    renderers.solver.enabled = false;
    mockContent.mockResolvedValue(CHALLENGE);

    await expect(renderPage("https://example.com/r")).resolves.toMatchObject({
      html: CHROMIUM_PAGE,
    });
    expect(mockGetBrowser.mock.calls.map(([renderer]) => renderer)).toEqual([
      "obscura",
      "chromium",
    ]);
  });

  it("hands on to the solver with Obscura off", async () => {
    renderers.obscura.enabled = false;
    chromiumPage = null;
    solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r")).resolves.toMatchObject({
      html: SOLVED_PAGE,
    });
    expect(mockGetBrowser.mock.calls.map(([renderer]) => renderer)).toEqual(["chromium"]);
  });

  it("is never asked while it is off", async () => {
    renderers.chromium.enabled = false;
    mockContent.mockResolvedValue(CHALLENGE);
    solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r")).resolves.toMatchObject({
      html: SOLVED_PAGE,
    });
    expect(mockGetBrowser.mock.calls.map(([renderer]) => renderer)).toEqual(["obscura"]);
  });
});

describe("renderPage – the solver's answer", () => {
  beforeEach(() => {
    renderers.obscura.enabled = false;
  });

  it.each([
    ["an error reply", async () => Response.json({ status: "error", message: "Timeout" })],
    ["a non-2xx reply", async () => new Response("bad gateway", { status: 502 })],
    ["a reply that is not JSON", async () => new Response("<html>a proxy</html>")],
    ["a timeout", async () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
    ["an unreachable endpoint", async () => Promise.reject(new TypeError("fetch failed"))],
  ])("counts %s as no HTML", async (_case, reply) => {
    solverAnswers(reply);

    await expect(renderPage("https://example.com/r")).resolves.toEqual({ html: "", status: null });
  });

  it("is read once, whatever the caller's reading of it says", async () => {
    solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r", undefined, () => false)).resolves.toEqual({
      html: SOLVED_PAGE,
      status: null,
    });
  });
});

describe("renderPage – Site Auth Tokens", () => {
  it("hands them to Obscura", async () => {
    solverAnswers(solved(SOLVED_PAGE));

    await renderPage("https://example.com/r", TOKENS);

    expect(mockCdpSend).toHaveBeenCalledWith(
      "Network.setExtraHTTPHeaders",
      expect.objectContaining({ headers: { Authorization: "Bearer abc" } })
    );
  });

  it("never hands them to the solver, and logs that they were withheld", async () => {
    mockContent.mockResolvedValue(CHALLENGE);
    const { sent } = solverAnswers(solved(SOLVED_PAGE));

    await renderPage("https://example.com/r", TOKENS);

    expect(JSON.stringify(sent())).not.toMatch(/sess-abc|Bearer abc|cookies|headers/);
    expect(log.info).toHaveBeenCalledWith(
      { url: "https://example.com/r", tokens: 2 },
      "Site Auth Tokens withheld from the solver"
    );
  });

  it("never hands them to the solver after the Chromium browser either", async () => {
    renderers.obscura.enabled = false;
    renderers.chromium.enabled = true;
    chromiumPage = null;
    const { sent } = solverAnswers(solved(SOLVED_PAGE));

    await expect(renderPage("https://example.com/r", TOKENS)).resolves.toMatchObject({
      html: SOLVED_PAGE,
    });
    expect(JSON.stringify(sent())).not.toMatch(/sess-abc|Bearer abc|cookies|headers/);
    expect(log.info).toHaveBeenCalledWith(
      { url: "https://example.com/r", tokens: 2 },
      "Site Auth Tokens withheld from the solver"
    );
  });

  it("logs nothing withheld when there were no tokens", async () => {
    renderers.obscura.enabled = false;
    solverAnswers(solved(SOLVED_PAGE));

    await renderPage("https://example.com/r");

    expect(log.info).not.toHaveBeenCalledWith(
      expect.anything(),
      "Site Auth Tokens withheld from the solver"
    );
  });
});
