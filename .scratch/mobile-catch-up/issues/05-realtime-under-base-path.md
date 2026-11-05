# 05: Realtime under a base path

**What to build:** A household member whose server runs under a base path gets live updates in the app. A grocery checked off on the web appears checked on the phone without a refresh. Today the app always connects its WebSocket at the root path, so realtime silently fails on such servers. See `.scratch/mobile-catch-up/spec.md`, "Realtime".

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] The app builds its WebSocket URL from the stored server address including its base path, matching where the server listens.
- [ ] A unit test covers the URL for a root server, a base-path server and a base-path server with a trailing slash.
- [ ] The stale reconnect-invalidation option the app passes to the shared providers, which no longer exists there, is removed.
- [ ] Checked by hand against a dev server running under a base path: a grocery checked off on the web appears checked on the smoke screen.
