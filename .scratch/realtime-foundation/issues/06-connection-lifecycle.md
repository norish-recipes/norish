# 06 — Connection lifecycle: one auth, an Origin check, 4401, an awaited shutdown

**What to build:** `packages/trpc/src/ws-server.ts` authenticates once, refuses foreign origins, tells an unauthenticated client so with a close code, and shuts down in seconds.

- The `upgrade` handler already calls `getVerifiedSession` (`:100-113`); it stores the resulting `User` on `req.realtimeIdentity` (extend the existing `declare module "node:http"` block at `:20-24`) and `createWsContext` in `packages/trpc/src/context.ts:106-141` builds the context from that instead of calling `getVerifiedSession` a second time. The WS context drops `operationId`: only subscriptions travel over the socket (`packages/shared-react/src/providers/trpc-links.ts:290-299` routes everything else over HTTP), so no mutation ever runs on it.
- An `Origin` header, when present, must match the origin of `SERVER_CONFIG.AUTH_URL`, an entry of `SERVER_CONFIG.TRUSTED_ORIGINS` (`packages/config/src/env-config-server.ts:93`), or `${scheme}://${host}` of the request; otherwise write `HTTP/1.1 403 Forbidden` and destroy the socket. An absent `Origin` (native clients, `curl`) is accepted.
- An unauthenticated upgrade completes the WebSocket handshake and is then closed with code **4401** and reason `Unauthorized`, replacing the raw `401` write at `:109-110`, so the client can distinguish "sign in again" from "server unreachable" by code alone.
- Export `stopTrpcWebSocket(): Promise<void>`: `trpcHandler.broadcastReconnectNotification()`, close every client with **1012** and reason `Service Restart`, `await` `wss.close()`, clear the `globalThis` handles. Replace the never-awaited `server.on("close", async …)` handler at `:137-146` with an awaited call from `packages/api/src/startup/shutdown.ts` placed right after the HTTP server closes; live sockets no longer hold `server.close()` open, so the 30 s timeout path stops firing on every deploy.
- `unregisterConnection` in `connection-manager.ts` becomes synchronous and the `ws.on("close")` handler at `ws-server.ts:125` wraps it in try/catch, so it can no longer produce an unhandled rejection.
- Keep-alive stays `pingMs: 20000`, `pongWaitMs: 5000`.

**Blocked by:** 05.

**Spec:** `.scratch/realtime-foundation/spec.md` § Connection lifecycle

**Status:** ready-for-human

- [x] `packages/trpc/__tests__/ws-server.test.ts` drives `server.emit("upgrade", req, socket, head)` with a fake socket and a spied `getVerifiedSession`: exactly one verification per connection
- [x] Origin cases in that test: mismatched → `403` and destroyed; matches `AUTH_URL` → accepted; matches a `TRUSTED_ORIGINS` entry → accepted; matches the host → accepted; absent → accepted
- [x] Unauthenticated → handshake completes, then close `4401`
- [x] `stopTrpcWebSocket` sends `1012` to every open socket and resolves; `shutdown.ts` awaits it right after HTTP close and the `server.on("close")` handler is gone
- [x] `ws.on("close")` cannot reject
- [x] `Context` has no `operationId` on the WS path; the HTTP path is unchanged
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green

## Comments

- Implemented on `claude/realtime-foundation-tickets-8ercvt`.
  - `isTrustedWebSocketOrigin(origin, host)` is exported from `ws-server.ts`; the host match accepts the request host under both `http` and `https`, because a TLS-terminating proxy hands the server an `http` socket while the browser saw `https`. An unparseable `Origin` (`null`, garbage) is refused.
  - `stopTrpcWebSocket()` removes its own `upgrade` listener (so a restart of the socket server in one process never leaves two handlers racing), sends 1012 to every client, and gives them `CLOSE_GRACE_MS` (2 s) to answer before terminating the rest; `wss.close()` resolves only once every client is gone, so a dead client can no longer stretch the shutdown.
  - Node counts an upgraded socket as a live connection, so `server.close()` would wait on the WebSockets it never closes (measured: it holds until the socket dies). `shutdown.ts` therefore starts the HTTP close, awaits `stopTrpcWebSocket()`, and only then awaits the HTTP close — "right after the HTTP server closes" its listener, not its last connection.
  - `Context.operationId` is optional; the HTTP builders still set it, the WS context omits it, and `authedProcedure` reads `ctx.operationId ?? null`. `createWsContext` no longer imports `getVerifiedSession`.
  - `packages/trpc/__tests__/ws-server.test.ts` runs a real `http` server and real `ws` clients on an ephemeral port (17 cases). The `server.on("close")` handler is gone and the test asserts the HTTP server has no close listener.
