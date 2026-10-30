import type { Browser } from "playwright-core";
import { chromium } from "playwright-core";

import { serverLogger as log } from "@norish/shared-server/logger";
import { withTimeout } from "@norish/shared/lib/with-timeout";

/** A CDP Page Renderer. */
export type BrowserRenderer = "obscura" | "chromium";

/**
 * A connection to a CDP Page Renderer, opened for one endpoint and token. Playwright Core dials
 * its CDP endpoint as given, with no debugger-metadata probe and no hostname rewriting.
 */
interface Connection {
  key: string;
  /** Shared while it opens, so two imports arriving while the browser is cold open one connection. */
  opening: Promise<Browser>;
  browser?: Browser;
}

/** One per renderer, so a setting change or a dropped browser replaces only that renderer's. */
const connections = new Map<BrowserRenderer, Connection>();

/**
 * Connect within `timeoutMs`, the part of a render's deadline that is left. A renderer that cannot
 * be reached is logged for the administrator and answers null.
 */
export async function getBrowser(
  renderer: BrowserRenderer,
  endpoint: string,
  token: string | undefined,
  timeoutMs: number
): Promise<Browser | null> {
  const key = `${endpoint}\n${token ?? ""}`;
  let connection = connections.get(renderer);

  // One connection serves every import; contexts, not connections, are what keeps concurrent
  // imports isolated. A connection the browser dropped, because it restarted say, is replaced here.
  if (connection?.key !== key || connection.browser?.isConnected() === false) {
    if (connection) void close(connection);
    connection = connect(renderer, endpoint, token, key, timeoutMs);
    connections.set(renderer, connection);
  }

  const { opening } = connection;

  try {
    // A caller joining an attempt opened for another render still gives up at its own deadline.
    return await withTimeout(() => opening, timeoutMs, `Connecting to ${renderer}`);
  } catch (error) {
    // A hosted browser may take its token in the query string, so no query string is logged.
    const hidden = (text: string) => text.replace(/[?#]\S*/g, "");

    log.error(
      { renderer, endpoint: hidden(endpoint), reason: hidden(String(error)) },
      `The ${renderer} Page Renderer is not reachable at ${hidden(endpoint)}. Start it or check its endpoint in admin settings.`
    );

    return null;
  }
}

function connect(
  renderer: BrowserRenderer,
  endpoint: string,
  token: string | undefined,
  key: string,
  timeoutMs: number
): Connection {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const opened: Connection = {
    key,
    opening: chromium.connectOverCDP(endpoint, { headers, timeout: timeoutMs }),
  };

  opened.opening.then(
    (browser) => {
      opened.browser = browser;
    },
    () => {
      // A failed attempt is not cached, so the next import retries once the browser is back.
      if (connections.get(renderer) === opened) connections.delete(renderer);
    }
  );

  return opened;
}

/** Close a connection, once it has opened when it is still opening, so none is left behind. */
async function close(closing: Connection): Promise<void> {
  const browser = await closing.opening.catch(() => null);

  await browser?.close().catch((error: unknown) => {
    log.error({ err: error }, "Error closing a browser connection");
  });
}

/** Close every renderer's connection. */
export async function closeBrowsers(): Promise<void> {
  const closing = [...connections.values()];

  connections.clear();
  await Promise.all(closing.map(close));
}

process.on("SIGINT", closeBrowsers);
process.on("SIGTERM", closeBrowsers);
