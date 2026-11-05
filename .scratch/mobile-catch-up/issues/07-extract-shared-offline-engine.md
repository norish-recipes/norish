# 07: Extract the offline engine into shared-react, with web unchanged

**What to build:** The web client's offline runtime becomes one engine in `@norish/shared-react` that any client can run by supplying a storage adapter. The engine covers the Outbox and its admission guarantee, Replay with error classification, parking of dependants, the Conflicted outcome, the replay leader lock, Recovery, the Cache Warmer and Warm Set, the connectivity probe and state machine, and the owner-scoped Offline Cache persister. Web runs it through an IndexedDB adapter, and nothing a web user sees changes. This is a move, not a rewrite. See `.scratch/mobile-catch-up/spec.md`, "Shared offline engine".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The engine's public interface takes a storage adapter and the client's tRPC replay transport. It returns the outbox link, the persister, the connectivity state and the status actions (sync now, retry, discard).
- [x] Platform-only concerns stay in the web app: the service worker and App Shell, and the Offline Toggle wiring. The engine has no web-only import.
- [x] The storage adapter interface covers:
  - durable Outbox entries per owner, with status, parked reason, operation id and Client-Minted Id
  - the persisted Offline Cache per owner
  - blob payloads for uploads
- [x] Web's existing IndexedDB code is the web adapter.
- [x] A storage adapter contract suite lives with the engine and the web adapter passes it. It covers owner scoping, entry ordering, status transitions, blob round-trips, and purge on account switch.
- [x] Web's existing outbox and connectivity unit tests move with the engine and pass against its public interface. None is deleted or weakened in the move.
- [x] The web offline E2E project passes unchanged.
- [x] CONTEXT.md's Connectivity & Offline terms say "a client" instead of "the web client".
- [x] ADR-0001 is amended to say the engine is shared and storage is per client. No new ADR.
