import type { Browser, BrowserContext, Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

import type { SessionCookies } from "../harness/auth";
import { signIn } from "../harness/auth";
import { withDatabase } from "../harness/database";
import { ProductionStack } from "../harness/production-stack";

export const USER_A = {
  email: "realtime-a@norish.test",
  password: "realtime-a-password-1",
  name: "Realtime A",
};
export const USER_B = {
  email: "realtime-b@norish.test",
  password: "realtime-b-password-1",
  name: "Realtime B",
};

export type Identity = "a" | "b";

/** What the page's own `WebSocket` saw: every open and every close code, in order. */
export interface SocketLedger {
  opens: number;
  closes: Array<{ code: number; reason: string; at: number }>;
}

/** The ledger as the page holds it: the serializable part plus the live socket. */
interface LiveSocketLedger extends SocketLedger {
  current?: WebSocket;
}

type LedgeredWindow = Window & { __socketLedger: LiveSocketLedger };

/**
 * Runs before any page script: the app's socket is the page's global
 * `WebSocket`, so wrapping it here is how a scenario reads close codes the
 * Playwright `websocket` event does not carry. Persisted per tab, so a close
 * that ends in a navigation (4401 sends the page to sign-in) is still on the
 * ledger the next document reads.
 */
function installSocketLedger(): void {
  const KEY = "__socketLedger";
  let ledger: LiveSocketLedger = { opens: 0, closes: [] };

  try {
    const stored = sessionStorage.getItem(KEY);

    if (stored) ledger = JSON.parse(stored) as LiveSocketLedger;
  } catch {
    // A page that cannot read its storage starts a fresh ledger.
  }

  const persist = () => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ opens: ledger.opens, closes: ledger.closes }));
    } catch {
      // Nothing to do: the in-memory ledger still serves this document.
    }
  };

  (window as unknown as LedgeredWindow).__socketLedger = ledger;

  const Native = window.WebSocket;

  class Ledgered extends Native {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      ledger.current = this;
      this.addEventListener("open", () => {
        ledger.opens += 1;
        persist();
      });
      this.addEventListener("close", (event) => {
        ledger.closes.push({ code: event.code, reason: event.reason, at: Date.now() });
        persist();
      });
    }
  }

  window.WebSocket = Ledgered;
}

export async function socketLedger(page: Page): Promise<SocketLedger> {
  return page.evaluate(() => {
    const { opens, closes } = (window as unknown as LedgeredWindow).__socketLedger;

    return { opens, closes };
  });
}

/** Until the page's socket has opened `opens` times in all. */
export async function waitForSocket(page: Page, opens: number, timeout = 30_000): Promise<void> {
  await expect
    .poll(async () => (await socketLedger(page)).opens, { timeout })
    .toBeGreaterThanOrEqual(opens);
}

/**
 * Drop the page's live socket the way a lost network does: the browser sees
 * the close, the server learns of it late or not at all. Call with the
 * context offline so the client's reconnects fail until it is back.
 */
export async function dropSocket(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as LedgeredWindow).__socketLedger.current?.close();
  });
}

export interface RealtimeStack {
  readonly baseURL: string;
  readonly server: ProductionStack;
  readonly cookies: Record<Identity, SessionCookies>;
  readonly userIds: Record<Identity, string>;
  /** A fresh browser context signed in as `identity`, its sockets ledgered. */
  newContext(identity: Identity): Promise<BrowserContext>;
}

interface RealtimeWorkerFixtures {
  realtimeStack: RealtimeStack;
}

/** A is the first sign-up and therefore the server owner; B is the other account. */
async function readUserIds(databaseUrl: string): Promise<Record<Identity, string>> {
  return withDatabase(databaseUrl, async (database) => {
    const rows = await database.query<{ id: string; is_owner: boolean }>(
      `select id, "isServerOwner" as is_owner from "user"`
    );
    const a = rows.rows.find((row) => row.is_owner)?.id;
    const b = rows.rows.find((row) => !row.is_owner)?.id;

    if (!a || !b || rows.rows.length !== 2) {
      throw new Error("The realtime harness did not provision exactly the owner and one member");
    }

    return { a, b };
  });
}

function makeContextFactory(
  browser: Browser,
  baseURL: string,
  cookies: Record<Identity, SessionCookies>,
  open: Set<BrowserContext>
) {
  return async (identity: Identity): Promise<BrowserContext> => {
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: cookies[identity], origins: [] },
      // The socket is what these scenarios are about; the offline runtime's
      // service worker would only add a second cache between them and the server.
      serviceWorkers: "block",
    });

    await context.addInitScript(installSocketLedger);
    open.add(context);
    context.on("close", () => open.delete(context));

    return context;
  };
}

/** No test-scoped fixtures: everything lives for the worker, like the stack. */
type NoTestFixtures = Record<never, never>;

async function cleanup(open: Set<BrowserContext>, stack: ProductionStack): Promise<void> {
  const results = await Promise.allSettled([
    ...[...open].map((context) => context.close()),
    stack.stop(),
  ]);
  const failures = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason);

  if (failures.length > 0) {
    throw new AggregateError(failures, "[realtime] worker fixture cleanup failed");
  }
}

export const test = base.extend<NoTestFixtures, RealtimeWorkerFixtures>({
  realtimeStack: [
    async ({ browser }, use) => {
      const stack = new ProductionStack({
        project: "realtime",
        port: 3300,
        databaseName: "norish_realtime_e2e",
        users: [USER_A, USER_B],
        captureLogs: true,
        environment: {
          // The scenarios assert on warn-level lines: a lagged subscription,
          // a Redis reconnect. The server logger reads NEXT_PUBLIC_LOG_LEVEL first.
          LOG_LEVEL: "warn",
          NEXT_PUBLIC_LOG_LEVEL: "warn",
          TRPC_LOG_LEVEL: "warn",
        },
      });
      const open = new Set<BrowserContext>();

      try {
        await stack.start();

        const [cookiesA, cookiesB] = await Promise.all([
          signIn(stack.baseURL, USER_A),
          signIn(stack.baseURL, USER_B),
        ]);
        const cookies = { a: cookiesA, b: cookiesB };
        const userIds = await readUserIds(stack.databaseUrl);

        await use({
          baseURL: stack.baseURL,
          server: stack,
          cookies,
          userIds,
          newContext: makeContextFactory(browser, stack.baseURL, cookies, open),
        });
      } finally {
        await cleanup(open, stack);
      }
    },
    { scope: "worker" },
  ],
});

export { expect };
export type { SessionCookies };
