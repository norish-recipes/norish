// @vitest-environment node
/**
 * The administrator's Test connection for the Chromium browser and the solver: what each is asked,
 * and the reason a failed test gives. The CDP connection, DNS and the solver are faked at the edge.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { testPageRenderer } from "@norish/shared-server/page-renderers";

const { connectOverCDP, close } = vi.hoisted(() => ({ connectOverCDP: vi.fn(), close: vi.fn() }));

vi.mock("playwright-core", () => ({ chromium: { connectOverCDP } }));
vi.mock("node:dns/promises", () => ({
  lookup: async () => [{ address: "172.18.0.5", family: 4 }],
}));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getPageRenderersConfig: async () => ({ navigationTimeoutMs: 30_000 }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  connectOverCDP.mockResolvedValue({ close });
});

describe("testPageRenderer – the Chromium browser", () => {
  it("connects by address and leaves again", async () => {
    await expect(testPageRenderer("chromium", "http://chromium:9222")).resolves.toEqual({
      success: true,
    });
    expect(connectOverCDP).toHaveBeenCalledWith("http://172.18.0.5:9222/", { timeout: 30_000 });
    expect(close).toHaveBeenCalled();
  });

  it("fails with the first line of the reason, without the token in the query string", async () => {
    connectOverCDP.mockRejectedValue(
      new Error(
        "connect ECONNREFUSED wss://browser.example/cdp?token=secret\nCall log:\n  - retrying"
      )
    );

    await expect(
      testPageRenderer("chromium", "wss://browser.example/cdp?token=secret")
    ).resolves.toEqual({ success: false, error: "connect ECONNREFUSED wss://browser.example/cdp" });
  });
});

describe("testPageRenderer – the solver", () => {
  it("reads a page", async () => {
    const solver = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ status: "ok", solution: { status: 200, response: "<html></html>" } })
    );

    vi.stubGlobal("fetch", solver);

    await expect(testPageRenderer("solver", "http://flaresolverr:8191/v1")).resolves.toEqual({
      success: true,
    });
    expect(solver.mock.calls[0]?.[0]).toBe("http://flaresolverr:8191/v1");
    expect(JSON.parse(String(solver.mock.calls[0]?.[1].body))).toEqual({
      cmd: "request.get",
      url: "https://example.com",
      maxTimeout: 30_000,
    });
  });

  it("fails with the cause fetch hides", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed", {
        cause: new Error("getaddrinfo ENOTFOUND flaresolverr"),
      });
    });

    await expect(testPageRenderer("solver", "http://flaresolverr:8191/v1")).resolves.toEqual({
      success: false,
      error: "getaddrinfo ENOTFOUND flaresolverr",
    });
  });

  it("fails on an answer without a page", async () => {
    vi.stubGlobal("fetch", async () => new Response("Not Found", { status: 404 }));

    await expect(testPageRenderer("solver", "http://flaresolverr:8191/")).resolves.toEqual({
      success: false,
      error: "The solver answered 404 without a page",
    });
  });
});
