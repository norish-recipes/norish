/**
 * The WebSocket server's connection lifecycle, against a real `http` server
 * and real `ws` clients on an ephemeral port: one session verification per
 * connection, the Origin check, 4401 after the handshake for an
 * unauthenticated client, and a shutdown that closes every socket with 1012.
 */

// @vitest-environment node

import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { initTRPC } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";

const getVerifiedSession = vi.hoisted(() => vi.fn());
const logger = vi.hoisted(() => ({
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
const connectionManager = vi.hoisted(() => ({
  registerConnection: vi.fn(),
  unregisterConnection: vi.fn(),
  stopInvalidation: vi.fn(),
  startConnectionInvalidation: vi.fn(),
}));

vi.mock("@norish/auth/session", () => ({ getVerifiedSession }));
vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    NODE_ENV: "production",
    AUTH_URL: "https://norish.example",
    TRUSTED_ORIGINS: ["https://alt.example:8443"],
  },
}));
vi.mock("@norish/shared-server/logger", () => ({ trpcLogger: logger }));
vi.mock("@norish/db", () => ({ getHouseholdForUser: vi.fn() }));
vi.mock("../src/connection-manager", () => connectionManager);
vi.mock("../src/router", () => {
  const t = initTRPC.create();

  return { appRouter: t.router({}) };
});

const { createWsContext } = await import("../src/context");
const { initTrpcWebSocket, isTrustedWebSocketOrigin, stopTrpcWebSocket } =
  await import("../src/ws-server");

const identity = {
  id: "user-1",
  email: "cook@norish.example",
  name: "Cook",
  image: null,
  version: 3,
  isServerAdmin: false,
};

let server: http.Server;
let port: number;

type Outcome =
  | { kind: "open"; ws: WebSocket }
  | { kind: "rejected"; status: number | null }
  | { kind: "closed"; code: number; reason: string };

/** Connect and report what the server did with the upgrade. */
function connect(headers: Record<string, string> = {}, path = "/trpc"): Promise<Outcome> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, { headers });

    ws.on("unexpected-response", (_req, res) => {
      resolve({ kind: "rejected", status: res.statusCode ?? null });
    });
    ws.on("error", () => resolve({ kind: "rejected", status: null }));
    ws.on("open", () => resolve({ kind: "open", ws }));
  });
}

function closed(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    ws.on("close", (code, reason) => resolve({ code, reason: reason.toString() }));
  });
}

async function connectAuthenticated(): Promise<WebSocket> {
  const outcome = await connect({ cookie: "session=ok" });

  if (outcome.kind !== "open") throw new Error(`Expected an open socket, got ${outcome.kind}`);

  return outcome.ws;
}

beforeEach(async () => {
  vi.clearAllMocks();
  getVerifiedSession.mockResolvedValue(identity);
  connectionManager.startConnectionInvalidation.mockReturnValue(connectionManager.stopInvalidation);

  server = http.createServer((_req, res) => res.end("ok"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  initTrpcWebSocket(server);
});

afterEach(async () => {
  await stopTrpcWebSocket();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("isTrustedWebSocketOrigin", () => {
  it("accepts an absent Origin", () => {
    expect(isTrustedWebSocketOrigin(undefined, "127.0.0.1:3000")).toBe(true);
  });

  it("accepts AUTH_URL, a TRUSTED_ORIGINS entry and the request host under either scheme", () => {
    expect(isTrustedWebSocketOrigin("https://norish.example", "127.0.0.1:3000")).toBe(true);
    expect(isTrustedWebSocketOrigin("https://alt.example:8443", "127.0.0.1:3000")).toBe(true);
    expect(isTrustedWebSocketOrigin("http://127.0.0.1:3000", "127.0.0.1:3000")).toBe(true);
    expect(isTrustedWebSocketOrigin("https://127.0.0.1:3000", "127.0.0.1:3000")).toBe(true);
  });

  it("refuses everything else, including an unparseable Origin", () => {
    expect(isTrustedWebSocketOrigin("https://evil.example", "127.0.0.1:3000")).toBe(false);
    expect(isTrustedWebSocketOrigin("https://norish.example:444", "127.0.0.1:3000")).toBe(false);
    expect(isTrustedWebSocketOrigin("null", "127.0.0.1:3000")).toBe(false);
    expect(isTrustedWebSocketOrigin("not a url", "127.0.0.1:3000")).toBe(false);
  });
});

describe("upgrade", () => {
  it("verifies the session exactly once per connection and hands the user to the context", async () => {
    const ws = await connectAuthenticated();

    expect(getVerifiedSession).toHaveBeenCalledTimes(1);
    expect(getVerifiedSession.mock.calls[0]?.[0].get("cookie")).toBe("session=ok");
    expect(connectionManager.registerConnection).toHaveBeenCalledWith("user-1", expect.anything());

    // The context reads the identity the upgrade left on the request.
    const req = {
      realtimeIdentity: identity,
      connectionId: "conn-1",
    } as unknown as http.IncomingMessage;
    const ctx = await createWsContext({ req, res: ws, info: {} } as never);

    expect(ctx).toEqual({ user: identity, household: null, connectionId: "conn-1" });
    expect("operationId" in ctx).toBe(false);
    expect(getVerifiedSession).toHaveBeenCalledTimes(1);

    ws.close();
    await closed(ws);
  });

  it("refuses a foreign Origin with 403 before verifying anything", async () => {
    const outcome = await connect({ origin: "https://evil.example", cookie: "session=ok" });

    expect(outcome).toEqual({ kind: "rejected", status: 403 });
    expect(getVerifiedSession).not.toHaveBeenCalled();
  });

  it.each([
    ["AUTH_URL", "https://norish.example"],
    ["a TRUSTED_ORIGINS entry", "https://alt.example:8443"],
  ])("accepts an Origin matching %s", async (_label, origin) => {
    const outcome = await connect({ origin, cookie: "session=ok" });

    expect(outcome.kind).toBe("open");
    if (outcome.kind === "open") {
      outcome.ws.close();
      await closed(outcome.ws);
    }
  });

  it("accepts an Origin matching the request host", async () => {
    const outcome = await connect({ origin: `http://127.0.0.1:${port}`, cookie: "session=ok" });

    expect(outcome.kind).toBe("open");
    if (outcome.kind === "open") {
      outcome.ws.close();
      await closed(outcome.ws);
    }
  });

  it("completes the handshake for an unauthenticated client, then closes it with 4401", async () => {
    getVerifiedSession.mockResolvedValue(null);

    const outcome = await connect();

    expect(outcome.kind).toBe("open");
    if (outcome.kind !== "open") return;

    await expect(closed(outcome.ws)).resolves.toEqual({ code: 4401, reason: "Unauthorized" });
    expect(connectionManager.registerConnection).not.toHaveBeenCalled();
  });

  it("treats a verification failure like no session", async () => {
    getVerifiedSession.mockRejectedValue(new Error("redis down"));

    const outcome = await connect();

    expect(outcome.kind).toBe("open");
    if (outcome.kind !== "open") return;

    await expect(closed(outcome.ws)).resolves.toMatchObject({ code: 4401 });
  });

  it("rejects an upgrade on another path", async () => {
    const outcome = await connect({}, "/other");

    expect(outcome).toEqual({ kind: "rejected", status: 404 });
  });

  it("swallows a throwing unregisterConnection on close", async () => {
    connectionManager.unregisterConnection.mockImplementation(() => {
      throw new Error("boom");
    });

    const ws = await connectAuthenticated();

    ws.close();
    await closed(ws);
    await vi.waitFor(() => expect(connectionManager.unregisterConnection).toHaveBeenCalled());

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      "Failed to unregister WebSocket connection"
    );
  });

  it("registers no close handler on the HTTP server", () => {
    expect(server.listenerCount("close")).toBe(0);
  });
});

describe("stopTrpcWebSocket", () => {
  it("closes every open socket with 1012 Service Restart and resolves", async () => {
    const first = await connectAuthenticated();
    const second = await connectAuthenticated();
    const closes = Promise.all([closed(first), closed(second)]);

    await stopTrpcWebSocket();

    await expect(closes).resolves.toEqual([
      { code: 1012, reason: "Service Restart" },
      { code: 1012, reason: "Service Restart" },
    ]);
    expect(connectionManager.stopInvalidation).toHaveBeenCalledTimes(1);
  });

  it("lets the HTTP server close promptly with sockets that were live", async () => {
    await connectAuthenticated();

    await stopTrpcWebSocket();

    const started = Date.now();

    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(Date.now() - started).toBeLessThan(1_000);

    // afterEach closes again; make that a no-op.
    server = http.createServer();
  });

  it("stops handling upgrades and can be started again", async () => {
    await stopTrpcWebSocket();

    const rejected = await connect({ cookie: "session=ok" });

    expect(rejected.kind).toBe("rejected");

    initTrpcWebSocket(server);

    const ws = await connectAuthenticated();

    ws.close();
    await closed(ws);
  });

  it("is a no-op when nothing is running", async () => {
    await stopTrpcWebSocket();
    await expect(stopTrpcWebSocket()).resolves.toBeUndefined();
  });
});
