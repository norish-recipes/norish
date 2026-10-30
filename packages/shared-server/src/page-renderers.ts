import { isIP } from "node:net";
import { chromium } from "playwright-core";
import { z } from "zod";

import { getPageRenderersConfig } from "@norish/shared-server/config/server-config-loader";
import { addressesOf } from "@norish/shared-server/private-addresses";

/** A solver launches a browser before it navigates, so it is given this on top of the timeout. */
const SOLVER_LAUNCH_MS = 15_000;

/**
 * The endpoint with its host as an address: Chromium's DevTools server refuses a Host header that
 * is not an IP or localhost. https and wss endpoints sit behind proxies without that check.
 */
export async function byAddress(endpoint: string): Promise<string> {
  const url = URL.parse(endpoint);

  if (
    !url ||
    !/^(?:http|ws):$/.test(url.protocol) ||
    isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
    /(?:^|\.)localhost$/.test(url.hostname)
  ) {
    return endpoint;
  }

  // A name that does not resolve is dialled as given, so the failure names it. IPv4 first, where
  // the shipped image's socat listens, then the lowest, so rotating records keep one connection.
  const [resolved] = (await addressesOf(url.hostname).catch(() => [])).sort(
    (a, b) => a.family - b.family || a.address.localeCompare(b.address)
  );

  if (!resolved) return endpoint;
  url.hostname = resolved.family === 6 ? `[${resolved.address}]` : resolved.address;

  return url.href;
}

const SolverReplySchema = z.object({
  status: z.literal("ok"),
  solution: z.object({ response: z.string() }),
});

/**
 * A FlareSolverr-compatible solver's HTML for the page; throws when it answers without one.
 * FlareSolverr and Byparr both hard-code the page's status to 200, so none is read.
 */
export async function solve(
  targetUrl: string,
  endpoint: string,
  maxTimeout: number
): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cmd: "request.get", url: targetUrl, maxTimeout }),
    signal: AbortSignal.timeout(maxTimeout + SOLVER_LAUNCH_MS),
  });
  const reply = SolverReplySchema.safeParse(
    response.ok ? await response.json().catch(() => null) : null
  );

  if (!reply.success) throw new Error(`The solver answered ${response.status} without a page`);

  return reply.data.solution.response;
}

/** A page any solver reads, so its test shows it reads pages and not only that it answers. */
const TEST_PAGE = "https://example.com";

/**
 * The administrator's Test connection: the Chromium browser is connected to and left, the solver
 * reads a page. The reason a test fails is the error's first line, without a query string.
 */
export async function testPageRenderer(
  renderer: "chromium" | "solver",
  endpoint: string
): Promise<{ success: boolean; error?: string }> {
  const { navigationTimeoutMs } = await getPageRenderersConfig();

  try {
    if (renderer === "solver") {
      await solve(TEST_PAGE, endpoint, navigationTimeoutMs);
    } else {
      const browser = await chromium.connectOverCDP(await byAddress(endpoint), {
        timeout: navigationTimeoutMs,
      });

      await browser.close();
    }

    return { success: true };
  } catch (error) {
    // fetch hides why it failed in its cause; a hosted browser's token rides in the query string.
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    const [reason = ""] = (cause instanceof Error ? cause.message : String(cause)).split("\n");

    return { success: false, error: reason.replace(/[?#]\S*/g, "") };
  }
}
