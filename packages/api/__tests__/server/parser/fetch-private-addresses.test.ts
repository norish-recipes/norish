// @vitest-environment node
/**
 * Allow private addresses (ADR-0019): off by default, a page fetch never reaches a loopback,
 * private or link-local address, before the plain fetch, at every redirect hop, and before the
 * Chromium browser and the solver. Obscura enforces its own deny, so it is not guarded here. DNS
 * is faked at the edge.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PageRenderersConfig } from "@norish/config/zod/server-config";
import { plainFetch, renderPage } from "@norish/api/parser/fetch";

const { lookup, mockGetBrowser } = vi.hoisted(() => ({
  lookup: vi.fn(),
  mockGetBrowser: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({ lookup }));
vi.mock("@norish/api/parser/browser-connections", () => ({ getBrowser: mockGetBrowser }));
vi.mock("@norish/shared-server/logger", () => ({
  parserLogger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

let renderers: PageRenderersConfig;

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getPageRenderersConfig: async () => renderers,
}));

/** What each name resolves to; anything unnamed is a public address. */
const DNS: Record<string, string[]> = {
  "router.lan": ["192.168.1.1"],
  "dual.example": ["93.184.215.14", "fd00::5"],
  "nas.tailnet.ts.net": ["100.101.102.103"],
  "bench.example": ["198.19.0.7"],
  "printer.local": ["224.0.0.251"],
  "reserved.example": ["240.0.0.9"],
  "nat64.example": ["64:ff9b::a00:8"],
};

/** CGNAT and Tailscale, benchmarking, multicast, reserved and NAT64: one literal and one name each. */
const OTHER_RANGES = [
  ["http://100.100.100.100/", "http://nas.tailnet.ts.net/"],
  ["http://198.18.0.1/", "http://bench.example/"],
  ["http://224.0.0.1/", "http://printer.local/"],
  ["http://255.255.255.255/", "http://reserved.example/"],
  ["http://[64:ff9b::7f00:1]/", "http://nat64.example/"],
].flat();

const PAGE = `<html><head><title>Lasagne</title></head><body>${"x".repeat(30_000)}</body></html>`;

/** Every request answered by `reply`; returns the URLs that were requested. */
function serve(reply: (url: string) => Response) {
  const fetchMock = vi.fn(async (url: string) => reply(url));

  vi.stubGlobal("fetch", fetchMock);

  return () => fetchMock.mock.calls.map(([url]) => url);
}

beforeEach(() => {
  vi.clearAllMocks();
  renderers = {
    obscura: { enabled: false, endpoint: "ws://obscura:9222" },
    chromium: { enabled: false, endpoint: "" },
    solver: { enabled: false },
    allowPrivateAddresses: false,
    navigationTimeoutMs: 30_000,
  };
  lookup.mockImplementation(async (host: string) => {
    const addresses = DNS[host] ?? (/^[\d.]+$|:/.test(host) ? [host] : ["93.184.215.14"]);

    return addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("plainFetch – private addresses refused by default", () => {
  it.each([
    "http://127.0.0.1/",
    "http://10.0.0.8/recipe",
    "http://172.20.1.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://0.0.0.0:3000/",
    "http://[::1]/",
    "http://[fd12:3456::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::127.0.0.1]/",
    "http://[2002:7f00:1::]/",
    "http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/",
    "http://2130706433/",
  ])("refuses %s without fetching it", async (url) => {
    const requested = serve(() => new Response(PAGE));

    await expect(plainFetch(url, "Norish")).resolves.toMatchObject({
      html: "",
      status: null,
      refused: true,
    });
    expect(requested()).toEqual([]);
  });

  it("refuses a hostname that resolves to a private address", async () => {
    const requested = serve(() => new Response(PAGE));

    await expect(plainFetch("http://router.lan/", "Norish")).resolves.toMatchObject({
      refused: true,
    });
    await expect(plainFetch("https://dual.example/", "Norish")).resolves.toMatchObject({
      refused: true,
    });
    expect(requested()).toEqual([]);
  });

  it("refuses a redirect hop that turns private", async () => {
    const requested = serve((url) =>
      new URL(url).hostname === "example.com"
        ? new Response(null, { status: 302, headers: { location: "http://192.168.1.1/admin" } })
        : new Response(PAGE)
    );

    await expect(plainFetch("https://example.com/r", "Norish")).resolves.toMatchObject({
      html: "",
      refused: true,
    });
    expect(requested()).toEqual(["https://example.com/r"]);
  });

  it("leaves public targets alone", async () => {
    serve(() => new Response(PAGE));

    await expect(plainFetch("https://example.com/r", "Norish")).resolves.toEqual({
      html: PAGE,
      status: 200,
      url: "https://example.com/r",
    });
  });

  it("leaves a name that does not resolve to the fetch to fail, not refused as private", async () => {
    const requested = serve(() => new Response(PAGE));

    lookup.mockRejectedValue(
      Object.assign(new Error("getaddrinfo ENOTFOUND gone.example"), { code: "ENOTFOUND" })
    );

    await expect(plainFetch("https://gone.example/r", "Norish")).resolves.not.toHaveProperty(
      "refused"
    );
    expect(requested()).toEqual(["https://gone.example/r"]);
  });

  it("reaches private addresses once the administrator allows them", async () => {
    renderers.allowPrivateAddresses = true;
    serve(() => new Response(PAGE));

    await expect(plainFetch("http://192.168.1.1/", "Norish")).resolves.toMatchObject({
      html: PAGE,
    });
    await expect(plainFetch("http://router.lan/", "Norish")).resolves.toMatchObject({
      html: PAGE,
    });
  });
});

describe("renderPage – the solver is guarded, Obscura is not", () => {
  const solved = () => Response.json({ status: "ok", solution: { status: 200, response: PAGE } });

  beforeEach(() => {
    renderers.solver = { enabled: true, endpoint: "http://flaresolverr:8191/v1" };
  });

  it("skips the solver for a private target", async () => {
    const requested = serve(solved);

    await expect(renderPage("http://router.lan/")).resolves.toEqual({ html: "", status: null });
    expect(requested()).toEqual([]);
  });

  it("asks the solver for a private target once private addresses are allowed", async () => {
    renderers.allowPrivateAddresses = true;
    serve(solved);

    await expect(renderPage("http://router.lan/")).resolves.toMatchObject({ html: PAGE });
  });

  it("still hands a private target to Obscura, which refuses it itself", async () => {
    renderers.obscura.enabled = true;
    mockGetBrowser.mockRejectedValue(new Error("refused"));
    serve(solved);

    await renderPage("http://router.lan/");

    expect(mockGetBrowser).toHaveBeenCalled();
  });
});

describe("renderPage – the Chromium browser is guarded like the solver", () => {
  const solved = () => Response.json({ status: "ok", solution: { status: 200, response: PAGE } });

  beforeEach(() => {
    renderers.chromium = { enabled: true, endpoint: "ws://127.0.0.1:9222" };
    renderers.solver = { enabled: true, endpoint: "http://flaresolverr:8191/v1" };
    mockGetBrowser.mockResolvedValue(null);
  });

  it("skips both for a private target, asking DNS about it once", async () => {
    const requested = serve(solved);

    await expect(renderPage("http://router.lan/")).resolves.toEqual({ html: "", status: null });
    expect(mockGetBrowser).not.toHaveBeenCalled();
    expect(requested()).toEqual([]);
    expect(lookup.mock.calls.filter(([host]) => host === "router.lan")).toHaveLength(1);
  });

  it("asks DNS about a public target once, for both", async () => {
    serve(solved);

    await expect(renderPage("https://example.com/r")).resolves.toMatchObject({ html: PAGE });
    expect(mockGetBrowser).toHaveBeenCalledOnce();
    expect(lookup.mock.calls.filter(([host]) => host === "example.com")).toHaveLength(1);
  });

  it("dials the Chromium browser for a private target once private addresses are allowed", async () => {
    renderers.allowPrivateAddresses = true;
    serve(solved);

    await renderPage("http://router.lan/");

    expect(mockGetBrowser).toHaveBeenCalledWith(
      "chromium",
      "ws://127.0.0.1:9222",
      undefined,
      expect.any(Number)
    );
  });
});

describe("the other ranges that are not the public internet", () => {
  const solved = () => Response.json({ status: "ok", solution: { status: 200, response: PAGE } });

  beforeEach(() => {
    renderers.solver = { enabled: true, endpoint: "http://flaresolverr:8191/v1" };
  });

  it.each(OTHER_RANGES)("refuses %s at the plain fetch and before the solver", async (url) => {
    const requested = serve(solved);

    await expect(plainFetch(url, "Norish")).resolves.toMatchObject({ html: "", refused: true });
    await expect(renderPage(url)).resolves.toEqual({ html: "", status: null });
    expect(requested()).toEqual([]);
  });

  it.each(OTHER_RANGES)("reaches %s once private addresses are allowed", async (url) => {
    renderers.allowPrivateAddresses = true;
    const requested = serve((to) => (to === url ? new Response(PAGE) : solved()));

    await expect(plainFetch(url, "Norish")).resolves.toMatchObject({ html: PAGE });
    await expect(renderPage(url)).resolves.toMatchObject({ html: PAGE });
    expect(requested()).toEqual([url, "http://flaresolverr:8191/v1"]);
  });
});
