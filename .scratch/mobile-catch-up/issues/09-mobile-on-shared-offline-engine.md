# 09: Mobile on the shared offline engine

**What to build:** A household member's offline work on the phone is as safe as on the web, because the app runs the same engine. A grocery checked off without signal is Queued and replayed in order when the server comes back. A change the server rejects stays Parked with a reason, and the user can retry or discard it. A change another member beat them to is Conflicted. Cached data stays on screen while the app refreshes, and signing out with unsynced work asks first. The app's own offline code is deleted. See `.scratch/mobile-catch-up/spec.md`, "Shared offline engine".

**Blocked by:** 04, 08

**Status:** ready-for-agent

- [ ] The app's tRPC provider and query client run the shared engine with the MMKV adapter. The app's own outbox, replay, persister and backend-health probe are deleted, with their tests.
- [ ] The device network signal only prompts an earlier probe; the probe verdict decides Live or Offline, as on web.
- [ ] Recovery refetches active queries without clearing their cached data, and the app no longer wipes its cache on reconnect.
- [ ] The Offline Cache and Outbox are scoped to the signed-in owner. Queued work of a signed-out owner replays only after that owner signs in again.
- [ ] Replay requests carry the shared replay marker with a mobile client value.
- [ ] The smoke screen shows Offline and syncing, and lists Parked and Conflicted entries with retry and discard.
- [ ] Signing out with unsynced work asks for confirmation first.
- [ ] A Maestro flow cuts the backend, checks off a grocery, restores the backend, and sees the change replayed on the web. Repeated runs show it is stable.
