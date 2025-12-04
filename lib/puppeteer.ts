import dns from "dns/promises";

import puppeteer, { Browser } from "puppeteer-core";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { serverLogger as log } from "@/server/logger";

let browser: Browser | null = null;

/**
 * Get the WebSocket endpoint from Chrome's remote debugging port.
 * Chrome exposes /json/version which contains the webSocketDebuggerUrl.
 *
 * IMPORTANT: Chrome DevTools has a security patch that rejects HTTP
 * requests with hostnames that aren't IP addresses or localhost.
 * See: https://bugs.chromium.org/p/chromium/issues/detail?id=813540
 *
 * To work around this, we resolve the hostname to an IP address before making
 * the HTTP request to discover the WebSocket endpoint.
 */
async function discoverWebSocketEndpoint(baseUrl: string): Promise<string> {
  // Parse the URL and resolve hostname to IP address
  const httpUrl = baseUrl.replace(/^ws:\/\//, "http://").replace(/\/$/, "");
  const url = new URL(httpUrl);

  // Resolve hostname to IP to bypass Chrome DevTools Host header security check
  // Chrome rejects non-IP, non-localhost hostnames with "Host header is specified
  // and is not an IP address or localhost"
  let resolvedHost = url.hostname;

  if (!isIpAddress(url.hostname) && !isLocalhost(url.hostname)) {
    try {
      const { address } = await dns.lookup(url.hostname);

      log.debug(
        { hostname: url.hostname, resolved: address },
        "Resolved hostname to IP for Chrome DevTools"
      );
      resolvedHost = address;
    } catch (error) {
      log.warn({ err: error, hostname: url.hostname }, "Failed to resolve hostname, using as-is");
    }
  }

  const versionUrl = `http://${resolvedHost}:${url.port}/json/version`;

  log.debug({ versionUrl }, "Discovering Chrome WebSocket endpoint");

  const response = await fetch(versionUrl);

  if (!response.ok) {
    throw new Error(`Failed to get Chrome version info: ${response.status} ${response.statusText}`);
  }

  const versionInfo = (await response.json()) as { webSocketDebuggerUrl?: string };

  if (!versionInfo.webSocketDebuggerUrl) {
    throw new Error("Chrome did not return webSocketDebuggerUrl");
  }

  // Replace the hostname in the returned WebSocket URL with the resolved IP
  // Chrome returns 0.0.0.0 which won't work from another container
  const wsUrl = new URL(versionInfo.webSocketDebuggerUrl);

  wsUrl.hostname = resolvedHost;
  wsUrl.port = url.port;

  log.debug({ webSocketDebuggerUrl: wsUrl.toString() }, "Discovered Chrome WebSocket endpoint");

  return wsUrl.toString();
}

function isIpAddress(host: string): boolean {
  // Simple check for IPv4 and IPv6
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":");
}

function isLocalhost(host: string): boolean {
  return host === "localhost" || host === "localhost.localdomain" || host.endsWith(".localhost");
}

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;

  // Check if we should connect to remote Chrome
  const chromeWsEndpoint = SERVER_CONFIG.CHROME_WS_ENDPOINT;

  if (chromeWsEndpoint) {
    try {
      browser = await puppeteer.connect({
        browserWSEndpoint: await discoverWebSocketEndpoint(chromeWsEndpoint),
      });
    } catch (error) {
      log.error({ err: error }, "Failed to connect to remote Chrome");
      throw new Error(
        "Chrome service not available. Please start the chrome service or check CHROME_WS_ENDPOINT."
      );
    }
  } else {
    throw new Error("No Chrome available. Set CHROME_WS_ENDPOINT to use a remote Chrome service.");
  }

  return browser;
}

export async function closeBrowser() {
  if (browser) {
    try {
      await browser.disconnect();
    } catch (error) {
      log.error({ err: error }, "Error closing browser");
    }
    browser = null;
  }
}

// Graceful shutdown
process.on("SIGINT", closeBrowser);
process.on("SIGTERM", closeBrowser);
