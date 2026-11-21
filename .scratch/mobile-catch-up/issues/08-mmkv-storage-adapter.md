# 08: MMKV storage adapter

**What to build:** The app gets a storage adapter for the shared offline engine that behaves exactly like the web one, proven by the same contract suite. Outbox entries and the Offline Cache are kept per owner in MMKV. An upload's file is copied into the app's own storage and referenced by path, so a photo attached offline survives until Replay. See `.scratch/mobile-catch-up/spec.md`, "Shared offline engine".

**Blocked by:** 02, 07

**Status:** done

- [x] The mobile adapter implements the engine's storage adapter interface on MMKV.
- [x] It passes the shared contract suite unchanged: owner scoping, entry ordering, status transitions, blob round-trips, and purge on account switch.
- [x] Upload payloads are stored as copies in the app's own storage, and the copies are removed when their entry is replayed, discarded or purged.
- [x] A failed write to storage surfaces as an admission failure, never as a silent success.

## Comments

- 2026-11-06 — `createMmkvStorage({ mmkv, files })` in `apps/mobile/src/lib/offline/mmkv-storage.ts`; `uploadFiles` (expo-file-system, `Paths.document/outbox-uploads`) in `upload-files.ts`. Entries store each copy by file name and resolve it to a uri on read, because iOS moves the app's container on update. Every copy goes through `outbox.remove`: Replay, discard and sign-out all remove entries, and an account switch leaves the Outbox dormant, so nothing else can orphan a copy. No `clearPersonalCaches` or `watch` yet; ticket 09 adds an image-cache clear if the app needs one.
- 2026-11-08 — Review fixes: an add now lands only after the add before it, so a slow upload copy can't let a later entry replay first, and a copy whose delete throws no longer fails `remove()`. The contract suite gained the Date and concurrent-enqueue cases. Open for the first screen that uploads: Expo 58's `fetch` rejects a `{ uri, name, type }` FormData part (`Unsupported FormDataPart implementation`), so that screen has to append expo-file-system `File`s and the adapter has to hand them back. Because the shared engine treats an error with no HTTP status as unreachable, such an upload would otherwise sit Queued at the head of the Outbox and block it.
