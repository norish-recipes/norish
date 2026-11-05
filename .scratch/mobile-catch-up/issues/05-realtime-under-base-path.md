# 05: Realtime under a base path

**What to build:** A household member whose server runs under a base path gets live updates in the app. A grocery checked off on the web appears checked on the phone without a refresh. Today the app always connects its WebSocket at the root path, so realtime silently fails on such servers. See `.scratch/mobile-catch-up/spec.md`, "Realtime".

**Blocked by:** 04

**Status:** ready-for-agent

- [x] The app builds its WebSocket URL from the stored server address including its base path, matching where the server listens.
- [x] A unit test covers the URL for a root server, a base-path server and a base-path server with a trailing slash.
- [x] The stale reconnect-invalidation option the app passes to the shared providers, which no longer exists there, is removed.
- [ ] Checked by hand against a dev server running under a base path: a grocery checked off on the web appears checked on the smoke screen.

## Comments

- 2026-11-05 — Done apart from the by-hand check, blocked like tickets 02-04: SDK 58 needs Xcode 27 to build the app and this Mac has Xcode 26.3. The server listens at `<base path>/trpc` (`addBasePath("/trpc")` in `packages/trpc/src/ws-server.ts`, the same path web's `getWsUrl` builds), and `getBackendWsUrl` in `apps/mobile/src/lib/network/backend-ws-url.ts` now appends `/trpc` to the stored address's path. It lives in its own file because `backend-base-url.ts` imports `use-cache-lifecycle`, which imports the tRPC provider. Ticket 02 had already removed the stale provider options.
