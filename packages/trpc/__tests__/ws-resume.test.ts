/**
 * The tRPC WebSocket link resends `lastEventId` after a reconnect.
 *
 * Resume relies on it: every subscription yields `tracked(cursor, item)`, and
 * the link must hand the last cursor back when the socket is killed
 * server-side. A real `ws` server on an ephemeral port and the real client
 * link prove it — no Norish code, only the contract Norish depends on.
 */

// @vitest-environment node

import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createTRPCClient, createWSClient, wsLink } from "@trpc/client";
import { initTRPC, tracked } from "@trpc/server";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import superjson from "superjson";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";

const t = initTRPC.create({ transformer: superjson });

const subscribeInputs: unknown[] = [];

const router = t.router({
  ticks: t.procedure
    .input(z.object({ lastEventId: z.string().nullish() }).optional())
    .subscription(async function* ({ input, signal }) {
      subscribeInputs.push(input);

      yield tracked(`cursor-${subscribeInputs.length}`, { n: subscribeInputs.length });

      await new Promise<void>((resolve) => {
        if (signal?.aborted) return resolve();
        signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    }),
});

type Router = typeof router;

let wss: WebSocketServer;
let handler: ReturnType<typeof applyWSSHandler>;
let port: number;

beforeAll(async () => {
  wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await once(wss, "listening");
  port = (wss.address() as AddressInfo).port;
  handler = applyWSSHandler({ wss, router, createContext: () => ({}) });
});

afterAll(async () => {
  for (const socket of wss.clients) socket.terminate();
  await new Promise<void>((resolve) => wss.close(() => resolve()));
});

async function waitFor(predicate: () => boolean, label: string, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;

  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("wsLink resume", () => {
  it("resends lastEventId equal to the last tracked id after a server-side socket kill", async () => {
    const wsClient = createWSClient({
      url: `ws://127.0.0.1:${port}`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
      retryDelayMs: () => 20,
    });
    const client = createTRPCClient<Router>({
      links: [wsLink({ client: wsClient, transformer: superjson })],
    });

    const received: unknown[] = [];
    const subscription = client.ticks.subscribe(undefined, {
      onData: (data) => received.push(data),
    });

    await waitFor(() => received.length === 1, "the first tracked event");
    expect(subscribeInputs).toEqual([undefined]);
    expect(received[0]).toEqual({ id: "cursor-1", data: { n: 1 } });

    for (const socket of wss.clients) socket.terminate();

    await waitFor(() => subscribeInputs.length === 2, "the resubscribe");
    expect(subscribeInputs[1]).toEqual({ lastEventId: "cursor-1" });

    await waitFor(() => received.length === 2, "the second tracked event");
    expect(received[1]).toEqual({ id: "cursor-2", data: { n: 2 } });

    subscription.unsubscribe();
    wsClient.close();
    void handler;
  });
});
