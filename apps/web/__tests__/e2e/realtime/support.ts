import type { Page, WebSocket as PageSocket } from "@playwright/test";
import { request } from "@playwright/test";
import { WebSocket as RawSocket } from "ws";

import type { Identity, RealtimeStack, SessionCookies } from "./fixture";
import { withDatabase } from "../harness/database";
import { waitForSocket } from "./fixture";

const TRPC_JSON = { "content-type": "application/json" };

function cookieHeader(cookies: SessionCookies): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

/** Call one tRPC mutation over HTTP as the context's user, the way the app does. */
export async function callMutation<T = unknown>(
  page: Page,
  baseURL: string,
  procedure: string,
  input: unknown
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const response = await page.request.post(`${baseURL}/api/trpc/${procedure}`, {
    headers: { ...TRPC_JSON, origin: baseURL },
    data: { json: input },
  });
  const body = (await response.json().catch(() => null)) as {
    result?: { data?: { json?: T } };
  } | null;

  return { ok: response.ok(), status: response.status(), data: body?.result?.data?.json ?? null };
}

export interface HouseholdRow {
  id: string;
  joinCode: string;
}

/** The household a user belongs to, once the asynchronous create/join has landed. */
export async function readHousehold(
  stack: RealtimeStack,
  userId: string
): Promise<HouseholdRow | null> {
  return withDatabase(stack.server.databaseUrl, async (database) => {
    const rows = await database.query<{ id: string; join_code: string | null }>(
      `select h.id, h.join_code
         from households h
         join household_users hu on hu.household_id = h.id
        where hu.user_id = $1`,
      [userId]
    );
    const row = rows.rows[0];

    return row && row.join_code ? { id: row.id, joinCode: row.join_code } : null;
  });
}

export async function readGrocery(
  stack: RealtimeStack,
  name: string
): Promise<{ id: string; version: number; isDone: boolean } | null> {
  return withDatabase(stack.server.databaseUrl, async (database) => {
    const rows = await database.query<{ id: string; version: number; is_done: boolean }>(
      `select id, version, is_done from groceries where name = $1 order by created_at desc limit 1`,
      [name]
    );
    const row = rows.rows[0];

    return row ? { id: row.id, version: row.version, isDone: row.is_done } : null;
  });
}

/**
 * Revoke every session of a user, the way Better Auth does it (sessions live
 * in Redis, so a row delete would not do). The browser keeps its cookie; the
 * next thing to present it learns that it is worthless.
 */
export async function revokeSessions(stack: RealtimeStack, identity: Identity): Promise<void> {
  const api = await request.newContext({
    baseURL: stack.baseURL,
    extraHTTPHeaders: { origin: stack.baseURL, ...sessionHeaders(stack, identity) },
  });

  try {
    // Better Auth wants a JSON body, even an empty one, or answers 415.
    const response = await api.post("/api/auth/revoke-sessions", { data: {} });

    if (!response.ok()) {
      throw new Error(`revoke-sessions failed: ${response.status()}`);
    }
  } finally {
    await api.dispose();
  }
}

/** Every WebSocket frame a page exchanged, newest last, with the socket it rode. */
export interface FrameLog {
  frames: Array<{ socket: number; direction: "sent" | "received"; payload: string; at: number }>;
  sockets: number;
  /** Stop recording; sockets opened after this are not followed. */
  stop: () => void;
}

/**
 * Record every frame on every socket the page opens, from now on. Playwright
 * reports frames per socket; a reconnect is a new socket, so the ledger keeps
 * a sequence number to tell them apart.
 */
export function recordFrames(page: Page): FrameLog {
  const onSocket = (socket: PageSocket) => {
    log.sockets += 1;
    const index = log.sockets;
    const push = (direction: "sent" | "received") => (frame: { payload: string | Buffer }) => {
      log.frames.push({ socket: index, direction, payload: String(frame.payload), at: Date.now() });
    };

    socket.on("framesent", push("sent"));
    socket.on("framereceived", push("received"));
  };
  const log: FrameLog = { frames: [], sockets: 0, stop: () => page.off("websocket", onSocket) };

  page.on("websocket", onSocket);

  return log;
}

/** Open `/groceries` and wait until the page's socket is connected. */
export async function openGroceries(page: Page): Promise<void> {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).waitFor();
  await waitForSocket(page, 1);
}

/** Add a grocery through the panel, the way a cook does, and wait for its row. */
export async function addGrocery(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(name);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await rowFor(page, name).waitFor();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}

export function rowFor(page: Page, name: string) {
  return page.locator(`[data-grocery-name="${name}"]`).first();
}

/**
 * A raw socket to the server's `/trpc` path, outside any browser: the way a
 * script, a proxy health check or a foreign page would knock.
 */
export function rawSocket(
  stack: RealtimeStack,
  headers: Record<string, string>
): Promise<{ socket: RawSocket; closed: Promise<{ code: number; reason: string }> }> {
  const url = `${stack.baseURL.replace(/^http/, "ws")}/trpc`;
  const socket = new RawSocket(url, { headers });
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    socket.once("close", (code, reason) => resolve({ code, reason: reason.toString() }));
  });

  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve({ socket, closed }));
    socket.once("unexpected-response", (_request, response) => {
      reject(new Error(`Unexpected server response: ${response.statusCode}`));
    });
    socket.once("error", reject);
  });
}

export function sessionHeaders(stack: RealtimeStack, identity: Identity): Record<string, string> {
  return { cookie: cookieHeader(stack.cookies[identity]) };
}

export async function redisClientCount(stack: RealtimeStack): Promise<number> {
  const list = await stack.server.redisCli("client", "list");

  // The CLI that ran the command is one of the listed clients; it is there
  // every time, so it cancels out of any comparison.
  return list.split("\n").filter((line) => line.trim().length > 0).length;
}
