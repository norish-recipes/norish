/**
 * The realtime layer, end to end, on the production stack (ADR-0032..0034).
 *
 * Two browsers in one household, one server, one Redis. What the spec's
 * Verification section asks of the browser gate: events cross between
 * browsers without a reload; a validation failure toasts only the browser
 * that caused it; a household join mid-connection restarts the joining
 * browser's socket and refuses its old cursor; the server's Redis connection
 * count is independent of open browsers; a Redis restart is logged once and
 * both browsers converge; a browser back from a network gap gets what it
 * missed through Resume before Recovery's refetch answers. And the release
 * checks that could be automated: a restart closes every socket with 1012 in
 * seconds, a foreign Origin is refused, an expired session ends at sign-in.
 *
 * Serial by design: every scenario builds on the household the first one
 * creates, and the disruptive ones (Redis restart, server restart, an
 * expired session) come last, in the order their damage allows.
 */
import { randomUUID } from "node:crypto";
import type { BrowserContext, Page, Response } from "@playwright/test";

import type { RealtimeStack } from "./fixture";
import type { HouseholdRow } from "./support";
import { dropSocket, expect, socketLedger, test, waitForSocket } from "./fixture";
import {
  addGrocery,
  callMutation,
  openGroceries,
  rawSocket,
  readGrocery,
  readHousehold,
  recordFrames,
  redisClientCount,
  revokeSessions,
  rowFor,
  sessionHeaders,
} from "./support";

test.describe.configure({ mode: "serial" });

const RESUME_TTL_SECONDS = 86_400;
/** The groceries page's own subscriptions: the events of the grocery catalogue. */
const GROCERY_SUBSCRIPTIONS = 8;
const RAW_SOCKETS_AT_SHUTDOWN = 50;
const SHUTDOWN_BUDGET_MS = 5_000;

let stack: RealtimeStack;
let household: HouseholdRow;
let contextA: BrowserContext;
let contextB: BrowserContext;
let pageA: Page;
let pageB: Page;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function closeCodes(page: Page): Promise<number[]> {
  return (await socketLedger(page)).closes.map((close) => close.code);
}

function serverLogged(fragments: string[]): boolean {
  return stack.server.logs().some((line) => fragments.every((fragment) => line.includes(fragment)));
}

/** The Redis client count once it has stopped moving, so a lazy connection is not misread as a tab's. */
async function settledRedisClientCount(): Promise<number> {
  let last = await redisClientCount(stack);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await delay(1_000);
    const next = await redisClientCount(stack);

    if (next === last) return next;
    last = next;
  }

  throw new Error("The Redis client count kept changing");
}

test.beforeAll(async ({ realtimeStack }) => {
  stack = realtimeStack;
  contextA = await stack.newContext("a");
  pageA = await contextA.newPage();

  // A founds the household before either browser opens a socket, so the
  // join later is the one Scope Change the scenario is about.
  const created = await callMutation(pageA, stack.baseURL, "households.create", {
    name: "Realtime household",
  });

  expect(created.ok).toBe(true);
  await expect.poll(() => readHousehold(stack, stack.userIds.a)).not.toBeNull();
  household = (await readHousehold(stack, stack.userIds.a))!;
  // The create finishes asynchronously with a connection invalidation; let it land.
  await delay(1_000);

  await openGroceries(pageA);
  contextB = await stack.newContext("b");
  pageB = await contextB.newPage();
  await openGroceries(pageB);
});

test.afterAll(async () => {
  await Promise.allSettled([contextA?.close(), contextB?.close()]);
});

test("a household join mid-connection restarts the joining browser's socket and refuses its old cursor", async () => {
  const before = await socketLedger(pageB);
  const refetched = pageB.waitForResponse(
    (response) => response.url().includes("groceries.list") && response.ok(),
    { timeout: 30_000 }
  );

  stack.server.clearLogs();
  const joined = await callMutation(pageB, stack.baseURL, "households.join", {
    code: household.joinCode,
  });

  expect(joined.ok).toBe(true);
  await expect.poll(() => readHousehold(stack, stack.userIds.b)).toEqual(household);

  // The Scope Change closes B's socket with 4000 (ADR-0033) ...
  await expect.poll(() => closeCodes(pageB)).toContain(4000);
  // ... B reconnects, resends the cursors minted under its old identity, and
  // every one of them is refused rather than read against the old channels.
  await waitForSocket(pageB, before.opens + 1);
  await expect
    .poll(() => serverLogged(["Realtime subscription lagged", '"reason":"identity-changed"']), {
      timeout: 30_000,
    })
    .toBe(true);
  // A lagged subscription refetches its domain.
  await refetched;

  // And from here on, B hears the household: a create by A reaches it live.
  await addGrocery(pageA, "na-toetreden");
  await expect(rowFor(pageB, "na-toetreden")).toBeVisible();
});

test("grocery create, update and delete reach the other browser without a reload", async () => {
  await addGrocery(pageA, "realtime-melk");
  await expect(rowFor(pageB, "realtime-melk")).toBeVisible();

  const created = (await readGrocery(stack, "realtime-melk"))!;
  const updated = await callMutation(pageA, stack.baseURL, "groceries.update", {
    groceryId: created.id,
    raw: "realtime-melk-hernoemd",
    version: created.version,
  });

  expect(updated.ok).toBe(true);
  await expect(rowFor(pageB, "realtime-melk-hernoemd")).toBeVisible();
  await expect(rowFor(pageB, "realtime-melk")).toHaveCount(0);

  const renamed = (await readGrocery(stack, "realtime-melk-hernoemd"))!;
  const deleted = await callMutation(pageA, stack.baseURL, "groceries.delete", {
    groceries: [{ id: renamed.id, version: renamed.version }],
  });

  expect(deleted.ok).toBe(true);
  await expect(rowFor(pageB, "realtime-melk-hernoemd")).toHaveCount(0);
});

test("a validation failure toasts only the browser that caused it", async () => {
  // A Store that does not exist: the insert fails on its foreign key, the
  // router announces `failed` to the one user, and nobody else.
  const failed = await callMutation(pageB, stack.baseURL, "groceries.create", [
    {
      id: randomUUID(),
      name: "kapotte-boodschap",
      unit: null,
      amount: null,
      storeId: randomUUID(),
    },
  ]);

  expect(failed.ok).toBe(false);
  await expect(pageB.getByText("Operation failed").first()).toBeVisible();
  // Long enough for a household-scoped event to have reached A, were it one.
  await pageA.waitForTimeout(2_000);
  await expect(pageA.getByText("Operation failed")).toHaveCount(0);
});

test("a browser back from a network gap gets what it missed through Resume, before Recovery's refetch answers", async () => {
  const frames = recordFrames(pageB);
  const before = await socketLedger(pageB);
  let releaseRefetch!: () => void;
  const refetchHeld = new Promise<void>((resolve) => {
    releaseRefetch = resolve;
  });
  const holdsRefetch = (url: URL) => url.pathname.includes("groceries.list");

  // Recovery's refetch is held until the row is on screen: if the row shows,
  // it came through the socket, not the list.
  await pageB.route(holdsRefetch, async (route) => {
    await refetchHeld;

    // The query client cancels a held refetch when it issues the next one;
    // a request that is gone by the time it is released is not a failure.
    await route.continue().catch(() => undefined);
  });

  try {
    // Chromium's offline emulation refuses new connections but leaves an open
    // socket be, so the gap is the two together: no network, and the socket gone.
    await contextB.setOffline(true);
    await dropSocket(pageB);
    await expect
      .poll(() => closeCodes(pageB).then((codes) => codes.length))
      .toBeGreaterThan(before.closes.length);

    await addGrocery(pageA, "tunnel-appel");
    await delay(5_000);

    await contextB.setOffline(false);
    await waitForSocket(pageB, before.opens + 1);
    await expect(rowFor(pageB, "tunnel-appel")).toBeVisible({ timeout: 30_000 });
  } finally {
    releaseRefetch();
    frames.stop();
    await pageB.unroute(holdsRefetch);
  }

  // The link resent the cursor, and the missed event — that row, by id —
  // rode the new socket.
  const missed = (await readGrocery(stack, "tunnel-appel"))!;
  const resubscribed = frames.frames.filter(
    (frame) =>
      frame.direction === "sent" &&
      frame.payload.includes("groceries.onCreated") &&
      frame.payload.includes("lastEventId")
  );
  const resumed = frames.frames.find(
    (frame) => frame.direction === "received" && frame.payload.includes(missed.id)
  );

  expect(resubscribed.length).toBeGreaterThan(0);
  expect(resumed).toBeDefined();
  expect(resumed!.socket).toBe(frames.sockets);
});

test("the server's Redis connection count does not depend on how many browsers are open", async () => {
  const withTwo = await settledRedisClientCount();
  const extra: BrowserContext[] = [];

  try {
    for (let index = 0; index < 5; index += 1) {
      const context = await stack.newContext("b");

      extra.push(context);
      await openGroceries(await context.newPage());
    }

    expect(await settledRedisClientCount()).toBe(withTwo);
  } finally {
    await Promise.all(extra.map((context) => context.close()));
  }

  // The Resume Buffer behind the household's grocery channel lives a day at most.
  const ttl = Number(
    await stack.server.redisCli("ttl", `norish:stream:grocery:household:${household.id}:created`)
  );

  expect(ttl).toBeGreaterThan(0);
  expect(ttl).toBeLessThanOrEqual(RESUME_TTL_SECONDS);
});

test("a foreign Origin is refused, an absent one is accepted, and no session closes with 4401", async () => {
  await expect(
    rawSocket(stack, { origin: "https://evil.example", ...sessionHeaders(stack, "b") })
  ).rejects.toThrow(/403/);

  const accepted = await rawSocket(stack, sessionHeaders(stack, "b"));

  accepted.socket.close(1000);
  expect((await accepted.closed).code).toBe(1000);

  const anonymous = await rawSocket(stack, {});

  expect(await anonymous.closed).toEqual({ code: 4401, reason: "Unauthorized" });
});

test("a Redis restart is logged once and both browsers converge afterwards", async () => {
  const groceryList = (response: Response) =>
    response.url().includes("groceries.list") && response.ok();
  const refetched = [pageA, pageB].map((page) =>
    page.waitForResponse(groceryList, { timeout: 30_000 })
  );

  stack.server.clearLogs();
  await stack.server.restartRedis();

  await expect.poll(() => serverLogged(["realtime.reconnected"]), { timeout: 30_000 }).toBe(true);
  // Every open subscription of both users ended Lagged with the one reason ...
  const laggedFor = (userId: string) =>
    stack.server
      .logs()
      .filter(
        (line) =>
          line.includes("Realtime subscription lagged") &&
          line.includes('"reason":"redis-reconnect"') &&
          line.includes(userId)
      ).length;

  for (const userId of [stack.userIds.a, stack.userIds.b]) {
    await expect
      .poll(() => laggedFor(userId), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(GROCERY_SUBSCRIPTIONS);
  }
  // ... and both browsers refetched the list.
  await Promise.all(refetched);

  await addGrocery(pageA, "na-redis-herstart");
  await expect(rowFor(pageB, "na-redis-herstart")).toBeVisible({ timeout: 30_000 });
});

test("a restart closes every socket with 1012 within seconds, and clients reconnect", async () => {
  const raw = await Promise.all(
    Array.from({ length: RAW_SOCKETS_AT_SHUTDOWN }, () =>
      rawSocket(stack, sessionHeaders(stack, "b"))
    )
  );
  const ledgerA = await socketLedger(pageA);
  const ledgerB = await socketLedger(pageB);

  const startedAt = Date.now();

  await stack.server.stopServer();
  const shutdownMs = Date.now() - startedAt;

  const closes = await Promise.all(raw.map((socket) => socket.closed));

  expect(closes.map((close) => close.code)).toEqual(
    Array.from({ length: RAW_SOCKETS_AT_SHUTDOWN }, () => 1012)
  );
  expect(shutdownMs).toBeLessThan(SHUTDOWN_BUDGET_MS);

  await stack.server.startServer();

  await expect.poll(() => closeCodes(pageA)).toContain(1012);
  await expect.poll(() => closeCodes(pageB)).toContain(1012);
  await waitForSocket(pageA, ledgerA.opens + 1, 60_000);
  await waitForSocket(pageB, ledgerB.opens + 1, 60_000);

  await addGrocery(pageA, "na-server-herstart");
  await expect(rowFor(pageB, "na-server-herstart")).toBeVisible({ timeout: 30_000 });
});

test("a revoked session ends at the sign-in page, not in a reconnect loop", async () => {
  await revokeSessions(stack, "b");
  // The live socket was authenticated at its upgrade; the next reconnect is
  // what presents the cookie again and is told 4401.
  await dropSocket(pageB);

  await expect(pageB).toHaveURL(/\/login\?callbackUrl=%2Fgroceries/, { timeout: 30_000 });
  // The ledger survives the navigation: the socket was told 4401, once.
  expect((await socketLedger(pageB)).closes.filter((close) => close.code === 4401)).toHaveLength(1);
});
