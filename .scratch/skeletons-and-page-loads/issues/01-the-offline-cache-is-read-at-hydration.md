# 01: The Offline Cache is read at hydration

**What to build:** A returning reader sees their cached data as soon as the app hydrates, without waiting for the browser's own session request.

- The `(app)` layout passes the reader's id, already verified by `readRequestProfile`, to `AppShell` beside the Device Preferences seed.
- `OfflineCacheController` reconciles with the seeded id on its first render instead of waiting for `useSession()`.
- An account switch takes the existing path: a seeded id that differs from the cache's owner purges the departed owner's reads first.
- The offline bootstrap still mounts the shell unseeded.

See `.scratch/skeletons-and-page-loads/spec.md`, The Offline Cache read at hydration.

**Blocked by:** None.

**Status:** done

- [x] The seeded id reaches `reconcileIdentity` without a `useSession()` round trip.
- [x] Unit tests: restore from the seeded id with no session; purge on a seeded id that differs from the owner.
- [x] The offline E2E project passes.
- [x] Release notes, Fixes and Improvements: "Norish shows your saved data sooner when you open it."

**Done 2026-10-15** (`e86689f72`): `AppShell` takes `userId`, `OfflineCacheController` uses it until `useSession()` answers. Offline E2E project 23/23 on a fresh build.
