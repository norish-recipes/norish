# 09: Mobile on the shared offline engine

**What to build:** A household member's offline work on the phone is as safe as on the web, because the app runs the same engine. A grocery checked off without signal is Queued and replayed in order when the server comes back. A change the server rejects stays Parked with a reason, and the user can retry or discard it. A change another member beat them to is Conflicted. Cached data stays on screen while the app refreshes, and signing out with unsynced work asks first. The app's own offline code is deleted. See `.scratch/mobile-catch-up/spec.md`, "Shared offline engine".

**Blocked by:** 04, 08

**Status:** ready-for-agent

- [x] The app's tRPC provider and query client run the shared engine with the MMKV adapter. The app's own outbox, replay, persister and backend-health probe are deleted, with their tests.
- [x] The device network signal only prompts an earlier probe; the probe verdict decides Live or Offline, as on web.
- [x] Recovery refetches active queries without clearing their cached data, and the app no longer wipes its cache on reconnect.
- [x] The Offline Cache and Outbox are scoped to the signed-in owner. Queued work of a signed-out owner replays only after that owner signs in again.
- [x] Replay requests carry the shared replay marker with a mobile client value.
- [x] The smoke screen shows Offline and syncing, and lists Parked and Conflicted entries with retry and discard.
- [x] Signing out with unsynced work asks for confirmation first.
- [ ] A Maestro flow cuts the backend, checks off a grocery, restores the backend, and sees the change replayed on the web. Repeated runs show it is stable.

## Comments

- 2026-11-06 — Done apart from running the Maestro flow, blocked like tickets 02, 04 and 06: SDK 58 needs Xcode 27 to build the app, this Mac has Xcode 26.3, and Maestro is not installed. `apps/mobile/maestro/offline-replay.yaml` is written but has never run, so its box stays open. The runner seeds a second grocery for it and serves the server through a TCP proxy on 3998 that the flow cuts and restores with `POST` on 3997 (Maestro's `http` in `evalScript`), so the backend goes away while the simulator's network stays up.
  - Web's platform-neutral glue moved to `@norish/shared-react/offline/react` and web runs on it: `useConnectivityLoop` (the probe loop plus WebSocket and device hints), `useOfflineController` (owner reconcile, Recovery triggers, the probe on a Live admission, the owner-switch hold), `useOutboxStatus` (the live Outbox with sync now, retry, discard) and `RecoveryProvider`. Web's `recovery-provider.tsx` and `lib/offline/sign-out.ts` are gone: the engine gained `unsyncedChanges()` and `clearForSignOut({ discardQueue })`, and the sign-out tests moved into the engine suite. `probeUrl` is a getter, since the app's server address is chosen at runtime. `sessionVerdict` is the one copy of the session check both clients' Recovery uses.
  - The app probes `/api/v1/health/ready` on the shared schedule; expo-network changes and a return to the foreground only call `probeNow`. The connect step still probes the deprecated `/api/v1/health` for the version gate. The replay value is `mobile-outbox`.
  - The persisted session now stands in while the live session is pending, errored or Offline, so an Offline launch opens on the smoke screen. `readPersistedSession` reads through the auth client's chunk-aware storage adapter; a chunked session read as unparseable before (test added).
  - A session invalidation signs out without discarding the queue, so it stays dormant until that owner signs in again. Changing the server address no longer clears caches: the reads are per owner and sign-out already cleared them.
  - The Warm Set holds data only (no `warmImages`) until a screen shows recipe images, and holds the calendar window two weeks either side of this week.
