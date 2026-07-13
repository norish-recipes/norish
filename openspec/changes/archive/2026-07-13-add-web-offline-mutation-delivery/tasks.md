## 1. Stable Operation Identity and Receipt Storage

- [x] 1.1 Add the idempotency-receipt schema and migration with principal-scoped operation ID uniqueness, procedure path, request fingerprint, processing lease, encrypted response, status, timestamps, and expiry fields.
- [x] 1.2 Add a receipt repository for atomic claim, live-lease inspection, completed-response lookup, conflict detection, lease recovery, completion, and expiry cleanup without exposing raw database access outside `packages/db`.
- [x] 1.3 Add canonical request fingerprinting for SuperJSON-compatible inputs and ordered `FormData` values, including file metadata and content hashes, without persisting raw request bodies.
- [x] 1.4 Add receipt-response serialization and authenticated encryption through the existing server encryption boundary, including safe handling for one-time secrets and binary-capable response values.
- [x] 1.5 Add a shared 30-day receipt/outbox retention configuration and a scheduled cleanup path that preserves active processing leases.
- [x] 1.6 Add receipt metrics and structured diagnostics for claims, exact duplicates, conflicts, in-progress responses, lease recovery, completion, and expiry without logging sensitive inputs or responses.

## 2. Universal Mutation Receipt Enforcement

- [x] 2.1 Validate `x-operation-id` at the authenticated tRPC boundary, generate an operation UUID for OpenAPI mutations that omit it, and leave queries and subscriptions receipt-free.
- [x] 2.2 Add receipt orchestration that authenticates first, atomically claims a new operation, returns the stored response for an exact duplicate, rejects changed path/input reuse, and suppresses concurrent duplicate execution.
- [x] 2.3 Preserve the first successful tRPC response exactly through receipt completion and duplicate replay, including create identifiers, transformed values, and one-time API-key results.
- [x] 2.4 Add a router-walking coverage test proving every app-router mutation passes through operation-ID validation and receipt handling without a path allowlist.
- [x] 2.5 Verify all first-party mutation transports preserve a caller-supplied operation ID across immediate retries; generate UUIDs for OpenAPI calls that omit one, update only compatibility gaps needed for enforcement, and do not redesign the mobile outbox in this change.
- [x] 2.6 Update direct tRPC documentation to require one stable `x-operation-id` per logical mutation and document the optional OpenAPI header for callers that need idempotent retries.

## 3. Deterministic Mutation-Safety Audit

- [x] 3.1 Inventory every app-router mutation by authoritative effect type: PostgreSQL write, BullMQ enqueue, file/media write, external/deferred workflow, or mixed effect.
- [x] 3.2 Make each PostgreSQL-only CUD handler participate in a receipt-aware repository transaction so the domain write and completed receipt commit atomically, without broadening this work into repository-boundary enforcement.
- [x] 3.3 Make every create mutation accept a stable client-generated entity ID or equivalent deterministic key and return the original entity on retry.
- [x] 3.4 Replace server-derived toggles or relative commands with explicit intended final state wherever delayed execution could otherwise invert the user's intent.
- [x] 3.5 Add expected-version checks to delayed updates and deletes, and preserve original `id` plus `version` snapshots for destructive bulk operations.
- [x] 3.6 Persist immutable targets for membership and lookup-based actions so replay cannot resolve a reused join code or mutable lookup value to a different entity.
- [x] 3.7 Give every BullMQ-producing mutation an operation-derived deterministic job identity and return the existing durable acceptance result on replay.
- [x] 3.8 Make file and media mutations use deterministic entity/path targets and retry-safe replace/delete semantics.
- [x] 3.9 Define durable-acceptance and replay behavior for external or mixed-effect mutations without holding PostgreSQL transactions open across Redis, filesystem, AI, or network work.
- [x] 3.10 Add a mutation-safety coverage fixture/test that fails when a new mutation lacks its required deterministic effect classification and contract.
- [x] 3.11 Remove `delayed-delivery-allowlist.ts`, its eligible/immediate-only arrays, lookup helpers, exports, and allowlist-specific tests after universal coverage passes.

## 4. Web IndexedDB Outbox Foundation

- [x] 4.1 Add a versioned web outbox entry model and IndexedDB migration with backend origin, authenticated user ID, operation ID, path, payload kind, encrypted input, creation order, attempt/backoff metadata, state, and expiry.
- [x] 4.2 Add origin-owned non-extractable Web Crypto key creation and encrypted payload/result persistence, with explicit failure when encryption or durable storage is unavailable.
- [x] 4.3 Add a lossless SuperJSON payload codec for ordinary tRPC mutation inputs and round-trip tests for supported transformed types.
- [x] 4.4 Add an ordered `FormData` codec that round-trips strings, duplicate field names, `Blob`, and `File` bytes plus name, MIME type, and last-modified metadata.
- [x] 4.5 Add quota and upload-limit checks so large archive, video, image, and batch payloads are never reported as queued unless IndexedDB persistence has completed.
- [x] 4.6 Add outbox repository operations for atomic enqueue, ordered selection, retry metadata updates, acknowledged-entry deletion, terminal retention, explicit discard, user/origin quarantine, and expiry.
- [x] 4.7 Add a completed-result store that keeps non-reconstructable one-time responses encrypted until the matching authenticated user consumes them.

## 5. Web Capture and Replay Coordination

- [x] 5.1 Insert a web-only mutation-delivery link after operation-ID assignment so every unreachable mutation is durably captured with its original operation ID and no path eligibility check.
- [x] 5.2 Distinguish unreachable transport failure from server/domain failure so only requests that did not obtain a server response are captured, and expose a typed queued-delivery condition only after durable enqueue succeeds.
- [x] 5.3 Mark replay operations in tRPC context so another unreachable replay updates the existing entry instead of recursively appending a duplicate.
- [x] 5.4 Bind replay startup and selection to the active backend origin and authenticated user, quarantine mismatches, and pause on authentication loss without replaying an entry under a later user.
- [x] 5.5 Add one in-process replay coordinator that processes entries serially in strict creation order and prevents concurrent browser components from starting overlapping passes.
- [x] 5.6 Add bounded retry/backoff handling for unreachable transport errors and receipt-in-progress responses while keeping later entries blocked behind the head item.
- [x] 5.7 Classify successful first delivery, exact duplicate response, stale/conflict result, authentication failure, terminal domain failure, local expiry, and explicit discard into deterministic outbox state transitions.
- [x] 5.8 Resume replay after application startup and connectivity recovery when authentication is ready; do not add service-worker background replay in this change.
- [x] 5.9 Refetch authoritative active TanStack queries after each startup/reconnect replay pass settles, whether the queue drains or stops with remaining work.

## 6. Web Optimistic UX and Result Reconciliation

- [x] 6.1 Audit every web and web-consumed shared mutation hook for optimistic update, rollback, invalidation, toast, and returned-result assumptions under the typed queued-delivery condition.
- [x] 6.2 Preserve optimistic cache state and suppress ordinary failure rollback/toasts when durable enqueue succeeds, while retaining normal error reconciliation when enqueue itself fails.
- [x] 6.3 Add a visible pending-delivery state and diagnostics surface for queued, retrying, quarantined, terminal, and expired web operations.
- [x] 6.4 Reconcile reconstructable replay results through authoritative refetch and surface retained one-time results to the matching user before acknowledgment and deletion.
- [x] 6.5 Surface terminal, conflict, stale-version, expiry, and quota outcomes with enough context for the user to understand which optimistic change did not persist.

## 7. Verification and Rollout

- [x] 7.1 Add server tests for exact duplicate replay, changed-input/path conflict, cross-user isolation, concurrent claim suppression, lost response recovery, lease recovery, encrypted one-time responses, and retention cleanup.
- [x] 7.2 Add effect-boundary tests proving atomic PostgreSQL write/receipt completion, operation-derived BullMQ dedupe, deterministic create identity, immutable membership targets, and retry-safe media effects.
- [x] 7.3 Add web storage tests for encrypted JSON and binary payload round trips, schema migration, quota failure, expiry, origin/user quarantine, explicit discard, and retained one-time responses.
- [x] 7.4 Add replay tests for strict FIFO blocking, restart recovery, reconnect recovery, authentication expiry, no recursive capture, backoff, duplicate acknowledgements, terminal outcomes, and final query refetch.
- [x] 7.5 Add end-to-end coverage for an offline optimistic mutation surviving reload and reconnect, plus a committed mutation whose lost response is retried without repeating its logical effect.
- [x] 7.6 Verify all existing web mutation hooks against the queued-delivery behavior and all app-router mutations against receipt and deterministic-safety coverage.
- [x] 7.7 Run scoped package tests while developing, then run dependency-cycle checks, full tests, lint, type checking/build, i18n and formatting checks, and `git diff --check` before enabling web capture.
- [x] 7.8 Document staged rollout and rollback controls: deploy receipt support first, enable universal server enforcement after coverage passes, then enable web capture/replay, with web capture independently disableable without deleting pending IndexedDB entries.

## 8. Live-test Follow-up and Versioned Technical Documentation

- [x] 8.1 Register `mutation-receipts-cleanup` in the shared scheduled-task type, producer, and worker; route execution through the API handler boundary; remove the duplicate process-local interval; and cover the scheduled path with focused tests.
- [x] 8.2 Remove the obsolete full-screen web connection overlay while retaining internal reconnect replay/refetch behavior, and verify the authenticated provider no longer mounts it.
- [x] 8.3 Normalize safe client error diagnostics so runtime failures retain their name, message, code, and cause instead of rendering as `[object Error]`, without logging mutation inputs or sensitive response data.
- [x] 8.4 Remove the rollout-only `web-offline-delivery` reference page, freeze docs `0.19.0-beta`, start the `0.20.0-beta` docs delta, and add a Technical offline-system page with architecture, replay, state, security, failure, and rollout diagrams/details.
- [x] 8.5 Run focused scheduled-task, web provider/error, shared outbox/error, docs type/build/format, dependency-cycle, and diff checks; resolve change-caused failures.

## 9. Offline Recipe Create Navigation

- [x] 9.1 Expose an acknowledged-delivery callback for `recipes.create` and defer recipe navigation until that callback fires, leaving the current app shell mounted when the mutation is durably queued.
- [x] 9.2 Add focused coverage proving create navigation does not run immediately or for Firefox-style queued transport failure, but does run after online acknowledgement.
- [x] 9.3 Document the loaded-screen testing boundary and run focused recipe, outbox, web typecheck, OpenSpec, dependency, formatting, and diff validation.

## 10. Delivery-aware recipe mutation consumers

- [x] 10.1 Audit web mutation consumers for route navigation or destructive UI transitions that run before server acknowledgement, and distinguish them from safe optimistic-only consumers.
- [x] 10.2 Extend acknowledged-delivery callbacks to recipe URL/paste/image imports, updates, and deletes; defer all mutation-driven route navigation until acknowledgement.
- [x] 10.3 Add focused hook and context coverage proving queued recipe mutations keep the current route mounted while acknowledged mutations retain their existing navigation behavior, with component call sites type-checked against the callback contract.
- [x] 10.4 Run the OpenSpec validator and the repository validation gates after the consumer audit fixes.

## 11. Documentation cleanup

- [x] 11.1 Remove development-testing, rollout, and current-boundaries prose from the public technical page.
- [x] 11.2 Delete acknowledged browser entries immediately while retaining one-time encrypted results separately until consumption, and update documentation and coverage.
