# 08: MMKV storage adapter

**What to build:** The app gets a storage adapter for the shared offline engine that behaves exactly like the web one, proven by the same contract suite. Outbox entries and the Offline Cache are kept per owner in MMKV. An upload's file is copied into the app's own storage and referenced by path, so a photo attached offline survives until Replay. See `.scratch/mobile-catch-up/spec.md`, "Shared offline engine".

**Blocked by:** 02, 07

**Status:** ready-for-agent

- [ ] The mobile adapter implements the engine's storage adapter interface on MMKV.
- [ ] It passes the shared contract suite unchanged: owner scoping, entry ordering, status transitions, blob round-trips, and purge on account switch.
- [ ] Upload payloads are stored as copies in the app's own storage, and the copies are removed when their entry is replayed, discarded or purged.
- [ ] A failed write to storage surfaces as an admission failure, never as a silent success.
