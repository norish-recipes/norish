// @vitest-environment node
/**
 * The CDP Page Renderers' connection seam. What Norish owns here is small on purpose: that it
 * dials the endpoint it is handed, that one healthy connection per renderer is reused, that a
 * connection the browser dropped is replaced on the next call, and that a failure is reported
 * to the administrator. Everything past `connectOverCDP` is the browser's.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockConnectOverCDP, log } = vi.hoisted(() => ({
  mockConnectOverCDP: vi.fn(),
  log: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("playwright-core", () => ({
  chromium: { connectOverCDP: mockConnectOverCDP },
}));

const ENDPOINT = "ws://obscura.test:9222";
const CHROMIUM = "ws://chromium.test:9222/devtools/browser";
const TIMEOUT = 30_000;

vi.mock("@norish/shared-server/logger", () => ({ serverLogger: log }));

/** A fresh module instance, so the cached connection never leaks across tests. */
async function loadModule() {
  vi.resetModules();

  return import("@norish/api/parser/browser-connections");
}

function connectedBrowser() {
  return {
    isConnected: vi.fn().mockReturnValue(true),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

/** Obscura and a Chromium browser, each at its own endpoint. */
function twoBrowsers() {
  const browsers = { obscura: connectedBrowser(), chromium: connectedBrowser() };

  mockConnectOverCDP.mockImplementation(async (endpoint: string) =>
    endpoint === CHROMIUM ? browsers.chromium : browsers.obscura
  );

  return browsers;
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("getBrowser – a renderer's connection", () => {
  it("connects to the configured endpoint", async () => {
    const browser = connectedBrowser();

    mockConnectOverCDP.mockResolvedValue(browser);

    const { getBrowser } = await loadModule();

    await expect(getBrowser("obscura", ENDPOINT, undefined, TIMEOUT)).resolves.toBe(browser);
    expect(mockConnectOverCDP).toHaveBeenCalledExactlyOnceWith("ws://obscura.test:9222", {
      headers: {},
      timeout: TIMEOUT,
    });
  });

  it("sends the configured token as a bearer header", async () => {
    mockConnectOverCDP.mockResolvedValue(connectedBrowser());

    const { getBrowser } = await loadModule();

    await getBrowser("obscura", ENDPOINT, "a".repeat(64), TIMEOUT);
    expect(mockConnectOverCDP).toHaveBeenCalledExactlyOnceWith("ws://obscura.test:9222", {
      headers: { Authorization: `Bearer ${"a".repeat(64)}` },
      timeout: TIMEOUT,
    });
  });

  it("reuses one healthy connection across imports", async () => {
    mockConnectOverCDP.mockResolvedValue(connectedBrowser());

    const { getBrowser } = await loadModule();
    const first = await getBrowser("obscura", ENDPOINT, undefined, TIMEOUT);

    await expect(getBrowser("obscura", ENDPOINT, undefined, TIMEOUT)).resolves.toBe(first);
    expect(mockConnectOverCDP).toHaveBeenCalledOnce();
  });

  it("opens one connection when two imports arrive while the browser is cold", async () => {
    const browser = connectedBrowser();
    let connect: (value: unknown) => void = () => {};

    mockConnectOverCDP.mockImplementation(
      () =>
        new Promise((resolve) => {
          connect = resolve;
        })
    );

    const { getBrowser } = await loadModule();
    // Both start before either finishes: without shared in-flight state the
    // second connection would orphan the first, and shutdown would only know
    // about one of them.
    const first = getBrowser("obscura", ENDPOINT, undefined, TIMEOUT);
    const second = getBrowser("obscura", ENDPOINT, undefined, TIMEOUT);

    connect(browser);

    await expect(first).resolves.toBe(browser);
    await expect(second).resolves.toBe(browser);
    expect(mockConnectOverCDP).toHaveBeenCalledOnce();
  });

  it("gives up on a connection still opening at the joining caller's own deadline", async () => {
    vi.useFakeTimers();
    mockConnectOverCDP.mockImplementation(async () => new Promise(() => {}));

    const { getBrowser } = await loadModule();

    void getBrowser("obscura", ENDPOINT, undefined, TIMEOUT);

    const joining = getBrowser("obscura", ENDPOINT, undefined, 5_000);
    const settled = vi.fn();

    joining.then(settled, settled);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(settled).toHaveBeenCalledOnce();
    expect(mockConnectOverCDP).toHaveBeenCalledOnce();
  });

  it("replaces the connection on the next request after the browser disconnects", async () => {
    const dropped = connectedBrowser();
    const replacement = connectedBrowser();

    mockConnectOverCDP.mockResolvedValueOnce(dropped).mockResolvedValueOnce(replacement);

    const { getBrowser } = await loadModule();

    await getBrowser("obscura", ENDPOINT, undefined, TIMEOUT);
    dropped.isConnected.mockReturnValue(false);

    await expect(getBrowser("obscura", ENDPOINT, undefined, TIMEOUT)).resolves.toBe(replacement);
    expect(mockConnectOverCDP).toHaveBeenCalledTimes(2);
  });

  it("closes a connection that opens after a newer setting's, and keeps the newer", async () => {
    const older = connectedBrowser();
    const newer = connectedBrowser();
    const connects: ((value: unknown) => void)[] = [];

    mockConnectOverCDP.mockImplementation(
      () =>
        new Promise((resolve) => {
          connects.push(resolve);
        })
    );

    const { getBrowser } = await loadModule();
    const first = getBrowser("obscura", ENDPOINT, undefined, TIMEOUT);
    const second = getBrowser("obscura", "ws://elsewhere.test:9222", undefined, TIMEOUT);

    connects[1]?.(newer);
    await second;
    connects[0]?.(older);
    await first;

    await vi.waitFor(() => expect(older.close).toHaveBeenCalledOnce());
    expect(newer.close).not.toHaveBeenCalled();
    await expect(
      getBrowser("obscura", "ws://elsewhere.test:9222", undefined, TIMEOUT)
    ).resolves.toBe(newer);
    expect(mockConnectOverCDP).toHaveBeenCalledTimes(2);
  });

  it("reports an unreachable endpoint to the administrator, and answers no browser", async () => {
    mockConnectOverCDP.mockRejectedValue(new Error("ECONNREFUSED"));

    const { getBrowser } = await loadModule();

    await expect(getBrowser("obscura", ENDPOINT, undefined, TIMEOUT)).resolves.toBeNull();
    expect(log.error).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        renderer: "obscura",
        endpoint: ENDPOINT,
        reason: "Error: ECONNREFUSED",
      }),
      expect.stringMatching(/obscura .*not reachable at ws:\/\/obscura.test:9222\..*admin settings/)
    );
  });

  it("retries the connection after a failure instead of caching it", async () => {
    const browser = connectedBrowser();

    mockConnectOverCDP.mockRejectedValueOnce(new Error("ECONNREFUSED")).mockResolvedValue(browser);

    const { getBrowser } = await loadModule();

    await expect(getBrowser("obscura", ENDPOINT, undefined, TIMEOUT)).resolves.toBeNull();
    await expect(getBrowser("obscura", ENDPOINT, undefined, TIMEOUT)).resolves.toBe(browser);
  });
});

describe("getBrowser – one connection per renderer", () => {
  it("keeps one per renderer, so concurrent renders on both never close each other's", async () => {
    const browsers = twoBrowsers();
    const { getBrowser } = await loadModule();
    const renders = () => [
      getBrowser("obscura", ENDPOINT, "token", TIMEOUT),
      getBrowser("chromium", CHROMIUM, undefined, TIMEOUT),
    ];

    await expect(Promise.all([...renders(), ...renders()])).resolves.toEqual([
      browsers.obscura,
      browsers.chromium,
      browsers.obscura,
      browsers.chromium,
    ]);
    await Promise.all(renders());

    expect(mockConnectOverCDP).toHaveBeenCalledTimes(2);
    expect(browsers.obscura.close).not.toHaveBeenCalled();
    expect(browsers.chromium.close).not.toHaveBeenCalled();
  });

  it("replaces only the renderer whose setting changed", async () => {
    const browsers = twoBrowsers();
    const { getBrowser } = await loadModule();

    await getBrowser("obscura", ENDPOINT, "token", TIMEOUT);
    await getBrowser("chromium", CHROMIUM, undefined, TIMEOUT);
    await getBrowser("obscura", ENDPOINT, "rotated", TIMEOUT);

    await vi.waitFor(() => expect(browsers.obscura.close).toHaveBeenCalledOnce());
    await expect(getBrowser("chromium", CHROMIUM, undefined, TIMEOUT)).resolves.toBe(
      browsers.chromium
    );
    expect(browsers.chromium.close).not.toHaveBeenCalled();
    expect(mockConnectOverCDP).toHaveBeenCalledTimes(3);
  });
});

describe("closeBrowsers – process shutdown", () => {
  it("closes every renderer's connection and forgets them", async () => {
    const browsers = twoBrowsers();
    const { getBrowser, closeBrowsers } = await loadModule();

    await getBrowser("obscura", ENDPOINT, undefined, TIMEOUT);
    await getBrowser("chromium", CHROMIUM, undefined, TIMEOUT);
    await closeBrowsers();

    expect(browsers.obscura.close).toHaveBeenCalledOnce();
    expect(browsers.chromium.close).toHaveBeenCalledOnce();

    await getBrowser("obscura", ENDPOINT, undefined, TIMEOUT);
    expect(mockConnectOverCDP).toHaveBeenCalledTimes(3);
  });

  it("survives a connection that fails to close", async () => {
    const browser = connectedBrowser();

    browser.close.mockRejectedValue(new Error("already gone"));
    mockConnectOverCDP.mockResolvedValue(browser);

    const { getBrowser, closeBrowsers } = await loadModule();

    await getBrowser("obscura", ENDPOINT, undefined, TIMEOUT);
    await expect(closeBrowsers()).resolves.toBeUndefined();
  });
});
