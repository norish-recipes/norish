## Context

Norish already generates an `operationId` in the shared tRPC link and preserves a caller-supplied value. That makes the ID stable for one client operation and for the existing mobile replay path, but the server uses it only for logging, queue propagation, and realtime correlation. The web provider has no outbox, the delayed-delivery allowlist is not a runtime web mechanism, and there is no receipt table that can replay a prior response after the server committed but the response was lost.

The app router currently exposes roughly one hundred mutation procedures. Most inputs are SuperJSON-compatible, while uploads and archive/image imports use `FormData`, `File`, and `Blob`. Some mutations write PostgreSQL rows, some create files, some enqueue BullMQ work, and some trigger deferred process or external-service effects. Universal delayed delivery therefore cannot be achieved by a transport retry alone: each mutation needs one stable logical identity and deterministic side-effect behavior.

API authentication already protects replayed requests, but it authenticates the current session. It cannot prove that a queued request was created by that same user. The web queue therefore needs backend-origin and user scoping in addition to normal server authorization.

## Goals / Non-Goals

**Goals:**

- Make every tRPC mutation delayable without a path allowlist.
- Keep one stable `operationId` across the first attempt, persistence, retries, and response replay.
- Prevent concurrent or later duplicate deliveries from repeating the logical mutation.
- Return the original successful response for an exact duplicate, including create identifiers and one-time results.
- Preserve deterministic version/snapshot behavior for conflicting offline writes.
- Persist all web mutation payloads, including binary `FormData`, in IndexedDB.
- Keep optimistic web state when delivery is queued and refetch authoritative state after reconnect replay.
- Prevent queued work from crossing backend origins or authenticated users.

**Non-Goals:**

- Refactor or harden the existing mobile outbox.
- Extract a shared web/mobile outbox core in this change; that is a follow-up deliverable after the web behavior is proven.
- Enforce the repository-only DB boundary across the monorepo; the receipt schema/repository follows the existing boundary, while broader import enforcement is separate work.
- Add a durable event store, replay Redis events, or implement incremental synchronization. Reconnect convergence uses query refetching.
- Run replay in a background service worker while the application is closed. IndexedDB survives closure and replay resumes on the next running session.
- Provide CRDT or automatic semantic merge behavior for stale writes.

## Decisions

### D1. `operationId` is the logical mutation identity

The shared operation-ID link remains the generation point. It generates exactly one opaque, collision-resistant ID before the first mutation attempt, writes it to operation context and `x-operation-id`, and preserves an existing context value. The web outbox stores that value and supplies it on replay, so the link cannot generate a replacement.

The server requires a valid `x-operation-id` for direct tRPC mutations. OpenAPI mutations receive a server-generated UUID when the caller omits the optional header; callers may provide a UUID and reuse it when they explicitly need idempotent transport retries. Queries and subscriptions remain receipt-free. This keeps first-party delayed replay strict without forcing operation-ID management onto ordinary API consumers.

Alternative considered: introduce a second `Idempotency-Key` header. Rejected because `operationId` is already propagated through HTTP, BullMQ, and realtime envelopes; two client identities would create mismatch and debugging risks.

### D2. Every mutation is universally delayable; the allowlist is removed

The current eligible/immediate-only arrays and lookup helpers are deleted. The invariant becomes structural: every `appRouter` mutation is covered by operation-ID validation and receipt middleware, and every handler must satisfy the deterministic contract appropriate to its effects.

Queries are never placed in the outbox. Procedures modeled as tRPC mutations are covered even when their current implementation is read-like, keeping transport behavior mechanically complete and avoiding a new path classification list.

The existing safety rules remain useful but become mandatory rather than eligibility criteria:

- state changes carry the requested final state rather than a server-derived toggle;
- updates/deletes carry expected versions;
- destructive bulk work carries the original `id` + `version` snapshot;
- creates carry stable client-generated identities or an equivalent deterministic key;
- enqueue operations use `operationId` as downstream dedupe identity;
- file effects target deterministic paths and tolerate retry.

Alternative considered: expand the existing allowlist until it contains every mutation. Rejected because an all-inclusive allowlist is redundant and can still drift when new procedures are added.

### D3. Receipts are scoped, fingerprinted, and securely replayable

The receipt repository stores a row with a unique `(principalId, operationId)` key, procedure path, canonical request hash, status/lease metadata, encrypted response payload, timestamps, and expiry. `principalId` is the authenticated Norish user ID regardless of cookie or API-key authentication mechanism.

The raw request is not persisted server-side. The server computes a canonical fingerprint from the procedure path and SuperJSON-equivalent input representation; `FormData` fingerprints include ordered field names, string values, file metadata, and content hashes. Reusing an ID with a different path or fingerprint returns `CONFLICT` and never invokes the handler.

Successful responses are serialized with the tRPC transformer and encrypted using the existing server encryption boundary before storage. This is required because responses can contain one-time API keys and inputs can contain provider or CalDAV credentials. An exact duplicate receives the decrypted original response without re-running the procedure.

Receipts use `processing` and `completed` states with a bounded processing lease. A concurrent duplicate matching a live processing receipt receives a retryable in-progress result and does not execute concurrently. The shared retention setting defaults to 30 days; web outbox entries cannot outlive the receipt window.

Alternative considered: store only a success boolean. Rejected because lost responses for creates and one-time secret generation require the original result, not merely proof that something happened.

### D4. Receipts complement deterministic handlers; they are not the sole crash defense

For PostgreSQL-only mutations, the authoritative write and receipt completion must commit atomically through receipt-aware repository transaction boundaries. Repository functions used by those handlers must accept or participate in the same transaction; the implementation must not hold that transaction open while waiting on Redis, HTTP, AI, or filesystem work.

For effects outside PostgreSQL:

- BullMQ jobs use a deterministic job identity derived from `operationId` and return the same acceptance result when already present.
- create contracts use client-generated entity IDs so replay resolves to the original entity.
- file writes use deterministic entity/path targets and safe replace/delete semantics.
- deferred or external workflows complete the receipt after durable acceptance, not after long-running completion.

After an expired `processing` lease, a request may execute again only when its mutation audit proves the underlying effect deterministic. This closes the crash window without pretending that a receipt row alone can provide exactly-once semantics across PostgreSQL, Redis, files, and external services.

Alternative considered: generic claim-then-execute middleware with no handler audit. Rejected because a crash after the side effect but before receipt completion could duplicate work on retry.

### D5. The web outbox uses IndexedDB with pluggable payload codecs

The first web implementation lives behind the web tRPC provider and uses an IndexedDB store. Each entry contains schema version, backend origin, user ID, operation ID, procedure path, encoded input, payload kind, creation time, attempts, next retry time, and delivery state.

SuperJSON-compatible inputs use the existing transformer. `FormData` is encoded as ordered entries; `File` and `Blob` values remain structured-cloneable binary records with name, type, and last-modified metadata. Payloads and deferred responses are encrypted with a non-extractable Web Crypto key owned by the origin. This limits casual storage disclosure, although active same-origin script execution remains inside the web application's existing trust boundary.

Storage failure or quota exhaustion is not reported as queued success. The original mutation fails with a clear local delivery error and optimistic state is reconciled.

Alternative considered: localStorage. Rejected because it is synchronous, quota-constrained, string-only, and unsuitable for binary payloads.

### D6. API authorization and client identity scoping solve different problems

Every replay still travels through the normal authenticated tRPC procedure and current authorization checks. Separately, the outbox processor selects only entries whose stored backend origin and user ID match the active web session. Entries belonging to another user remain quarantined until that user returns or explicitly discards them.

Authentication failure pauses replay and triggers the existing session handling; it does not retry the item under a later user. This prevents Alice's queued command from being applied as Bob even though both sessions would independently pass API authentication.

Alternative considered: rely only on API authentication. Rejected because the API sees the replaying principal, not the principal that originally created a client-side queue entry.

### D7. Replay is single-coordinator, strict FIFO, and followed by refetch

One in-process coordinator owns replay. It processes stored entries serially in creation order. If the head item is in backoff or fails with a retryable delivery error, later entries remain blocked so dependent commands cannot overtake it. Exact duplicate responses and successful first deliveries delete the acknowledged browser entry immediately. Non-reconstructable one-time responses are retained separately until consumption.

Backend terminal errors remove the item from the pending queue, retain a short diagnostic/completion record, and surface a user-visible result. After every reconnect replay pass, the web QueryClient refetches authoritative active queries whether the queue fully drains or stops on a terminal/stale outcome. Redis realtime events remain latency hints and are not required for convergence.

Alternative considered: replay all currently eligible entries while an earlier entry backs off. Rejected because creates followed by updates/deletes can depend on stored order.

### D8. Queued delivery is separate from the mutation's domain response

When an unreachable mutation is durably queued, the transport exposes a typed queued-delivery condition. Web mutation hooks and shared optimistic helpers treat that condition as accepted for delivery: they retain optimistic cache state and avoid ordinary failure toasts or rollback. The original procedure response type is not faked with a synthetic object.

Replay responses are consumed by a web operation-result coordinator. Reconstructable results are reconciled through refetch. Responses containing non-reconstructable one-time data remain encrypted in a completed entry and are surfaced to the authenticated user before acknowledgment and deletion.

Alternative considered: return a synthetic `{ queued: true }` as every mutation result. Rejected because it violates existing tRPC output contracts and would require unsafe unions throughout domain hooks.

### D9. Deliverables stay independently verifiable

This change has two implementation deliverables:

1. Stable operation IDs, universal deterministic mutation contracts, and server receipts.
2. The web IndexedDB outbox, optimistic delivery behavior, replay, and reconnect refetch.

The web deliverable cannot be enabled until server receipt coverage and the router-wide deterministic audit pass. Mobile outbox hardening/shared-core extraction and repository-boundary enforcement are separate future OpenSpec changes.

### D10. Offline status is informative, never application-blocking

The web client no longer mounts the legacy full-screen WebSocket connection overlay. HTTP mutations and queries can remain useful when the lazy WebSocket is idle or reconnecting, and unreachable mutations now have their own durable queue and visible delivery diagnostics. WebSocket state can still trigger replay and authoritative refetch internally, but it must not prevent the user from interacting with the application.

### D11. Receipt cleanup uses the existing scheduled-task worker

Receipt expiry cleanup is registered as a first-class `mutation-receipts-cleanup` scheduled task alongside the existing daily maintenance jobs. The API package supplies the database/metric callback through the established queue-handler boundary so `@norish/queue` does not import `@norish/trpc` and create a package cycle. This replaces the additional process-local interval and ensures the producer and worker share one task type definition.

### D12. Technical documentation starts with the offline system

The rollout-only `reference/web-offline-delivery` page is removed. Docusaurus freezes the pre-feature documentation as `0.19.0-beta`, labels the editable docs as `0.20.0-beta`, and adds a Technical section whose first page explains operation identity, capture, encrypted IndexedDB storage, receipt orchestration, FIFO replay, reconciliation, failure states, limitations, and rollout controls with rendered diagrams.

### D13. Queued creates do not trigger server-dependent navigation

The recipe context no longer navigates immediately after starting `recipes.create`. The mutation hook exposes a delivery callback that fires only after the server acknowledges the create. Online acknowledgement navigates to the reserved recipe ID as before. A typed queued-delivery result preserves the optimistic recipe and leaves the current form/app shell mounted, allowing the outbox status surface to report pending delivery without causing Next.js to fetch an unavailable RSC payload and fall back to a full browser navigation.

This is intentionally narrower than offline route caching. Refreshing, reopening, or navigating to an uncached Next.js route while the entire origin is offline remains outside the web mutation-outbox deliverable.

### D14. Mutation-driven navigation waits for acknowledged delivery

The acknowledged-delivery callback contract applies to every recipe mutation whose consumer starts a Next.js route navigation. URL, paste, and image imports navigate home only after the server acknowledges the import; updates navigate to the recipe detail only after acknowledgement; and deletes navigate home only after acknowledgement. A durably queued mutation may retain its optimistic UI and dismiss transient input UI, but it must leave the currently loaded route mounted so Next.js does not request an unavailable RSC payload.

Mutation consumers that only update optimistic local state, close a non-route overlay, or clear input already captured by the durable outbox do not require server acknowledgement unless their next action depends on the procedure response. Manual navigation, refresh, and reopening an uncached route remain outside this change.

## Risks / Trade-offs

- [Universal coverage touches every mutation, including admin, uploads, imports, and external workflows] → Build a router-walking audit and migrate by effect class before enabling web capture.
- [Atomic receipt completion is difficult across existing repository-local transactions] → Add receipt-aware transaction entry points for PostgreSQL handlers and deterministic downstream identities for non-PostgreSQL effects.
- [IndexedDB can exceed quota for large archives, videos, or image batches] → Check available storage, honor existing upload limits, fail visibly when durable persistence cannot be guaranteed, and never claim the mutation was queued.
- [Persisted payloads and responses can contain secrets] → Encrypt all stored payloads/responses, persist request hashes rather than raw server-side requests, avoid logs, and delete acknowledged data promptly.
- [Strict FIFO lets one retryable item block unrelated later work] → Prefer correctness for the first release; expose diagnostics and explicit discard for poisoned entries.
- [Requiring `x-operation-id` breaks older direct tRPC clients] → Keep first-party operation-ID coverage ahead of enforcement; generate UUIDs at the OpenAPI boundary so ordinary API clients remain compatible.
- [Optimistic UI may diverge while several operations are queued] → Preserve per-entity version/snapshot inputs and always refetch after replay.
- [One-time replay results can be missed after navigation or restart] → Keep completed sensitive results encrypted until the same user explicitly consumes them.

## Migration Plan

1. Add the receipt schema/repository, encryption, retention cleanup, and observability without enforcing mutation coverage.
2. Add receipt middleware and operation-ID validation tests; update first-party web/mobile transports to send stable IDs and generate IDs for OpenAPI requests that omit them.
3. Audit every app-router mutation by effect class and add deterministic IDs, versions, snapshots, job dedupe, or file semantics until the universal coverage test passes.
4. Enable receipt enforcement for all mutation procedures and remove the delayed-delivery allowlist, helpers, and allowlist tests.
5. Add the web IndexedDB store/codecs, user/origin scoping, result coordinator, and strict replay processor behind disabled provider wiring.
6. Audit web optimistic hooks, enable capture/replay, and verify offline mutation, reload, sign-out/sign-in, reconnect, duplicate-response, binary upload, and refetch scenarios.
7. Rollback by disabling web capture/replay first while leaving IndexedDB entries untouched for a corrective release. Receipt enforcement can remain because immediate online mutations use the same stable IDs; the receipt migration is removed only after its retention window and queued clients are no longer possible.

## Open Questions

- None required before implementation. The initial shared receipt/outbox retention is 30 days, strict FIFO is intentional, terminal replay errors are surfaced then reconciled by refetch, and background service-worker replay is deferred.
