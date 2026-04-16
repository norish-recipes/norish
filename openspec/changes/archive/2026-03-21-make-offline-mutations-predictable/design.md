## Context

The planned mobile outbox does not retry failed business events or wait for a later receipt; it simply stores a mutation request while the backend is unreachable and sends that same request later. That means mutation safety depends on the request itself carrying enough information to still mean the same thing when it is delivered after other household changes have already happened.

Norish already has two important foundations in place:

1. `operationId` propagation from the client edge through tRPC context and realtime envelopes.
2. Row-level `version` columns on mutable tables from the `entity-version-contracts` change.

The gap is that many write paths still behave as though the request is executed immediately:

- some contracts still mean "flip whatever the server sees now"
- some bulk deletes act on the server's current container contents instead of the client's original snapshot
- many repositories accept `version` but ignore it in the SQL `WHERE` clause
- some creates or membership actions derive their target from mutable live state instead of deterministic request state

Current unsafe mutation inventory found in the repo:

- **Backend-derived toggles**: `favorites.toggle`
- **Version-blind row updates/deletes**: `ratings.rate`; groceries `update`, `delete`, `assignToStore`, `reorderInStore`; recurring groceries `updateRecurring`, `deleteRecurring`, `checkRecurring`; stores `update`, `reorder`, `delete`; households `leave`, `kick`, `regenerateCode`, `transferAdmin`; calendar `moveItem`, `updateItem`, `deleteItem`; recipes `update`, `updateCategories`, `delete`, `convertMeasurements`, `deleteGalleryImage`, `deleteGalleryVideo`; user `updatePreferences`, `updateName`, `uploadAvatar`, `deleteAvatar`, `setAllergies`; CalDAV `saveConfig`, `deleteConfig`; site auth tokens `update`, `remove`
- **Live-state-dependent destructive or membership actions**: `stores.delete` with grocery deletion or unassignment based on the store's current contents; `households.join` because it resolves a mutable join code at delivery time
- **Create flows that are not deterministic under delayed delivery yet**: groceries `create`, recurring groceries `createRecurring`, stores `create`, households `create`, calendar `createItem`
- **Side-effectful repeat-work candidates that must be classified explicitly**: CalDAV `triggerSync` and `syncAll`

There are also a few paths that are already closer to the desired shape:

- `groceries.toggle` already carries explicit `isDone` instead of a backend flip
- `groceries.markAllDone` and `groceries.deleteDone` already capture row snapshots client-side
- several clients already send `version`, but the server does not consistently enforce it

## Goals / Non-Goals

**Goals:**

- Define the contract rules that make a mutation safe for delayed mobile delivery.
- Inventory every currently unsafe mutation family and group them by migration pattern.
- Replace backend-derived toggle semantics with explicit final-state semantics.
- Require destructive bulk/container mutations to act only on the client snapshot that was captured when the user triggered the action.
- Enforce version-aware compare-and-swap behavior in repository write paths so stale delayed requests do not overwrite newer state.
- Exclude create-style and repeat-work mutations from the first delayed-delivery allowlist while documenting the follow-up work they would need later.
- Keep security-sensitive versioned mutations in scope when they can satisfy the same safety rules as other delayed-delivery-compatible writes.

**Non-Goals:**

- Building the outbox, delivery worker, or request persistence itself.
- Retrying failed business operations or adding exactly-once guarantees.
- Adding a new receipt table, dedupe table, or event-validation workflow.
- Introducing user-facing conflict-resolution UI.
- Solving general offline-first data sync beyond predictable delayed delivery.

## Decisions

### 1. Treat delayed-delivery safety as an explicit mutation contract capability

**Decision:** A mutation SHALL be eligible for delayed delivery only if its request shape and server write path satisfy one of the approved safe patterns defined in this change. Mutations that do not yet satisfy those rules remain immediate-only until migrated.

**Why:** This gives the mobile outbox an eventual allowlist boundary instead of assuming every existing mutation is safe once `appOnline` is restored.

**Alternatives considered:**

- _Assume all current mutations are safe once versions exist_: rejected because many repositories currently ignore those versions.
- _Make the outbox decide case-by-case without a shared contract_: rejected because the safety rules belong at the API boundary, not inside the transport queue.

### 2. Standardize on three safe mutation patterns

**Decision:** Delayed-delivery-compatible mutations SHALL use one of these patterns:

1. **Explicit final-state mutation**: request includes the desired end state (`isDone: true`, `isFavorite: false`, `enabled: true`) instead of "toggle" or "flip".
2. **Snapshot-scoped bulk/container mutation**: request includes the exact rows the user saw (`id` + `version` snapshot), and the server acts only on that set.
3. **Deterministic create/membership mutation**: request includes a stable identity or deterministic target so late delivery cannot create a duplicate or resolve against a changed live lookup.

**Why:** These three shapes cover the unsafe patterns already present in groceries, stores, favorites, households, calendar, and profile-style writes.

**Alternatives considered:**

- _Keep server-derived toggles and broad live sweeps_: rejected because late delivery changes the meaning of the same request.
- _Rely on `updatedAt` or current reads instead of explicit snapshots_: rejected because it still allows stale requests to target the wrong current rows.

### 3. Enforce version checks in the write query itself

**Decision:** When a mutation carries `version`, repository writes SHALL compare that version in the authoritative update/delete query itself. A stale delayed request SHALL leave the newer row unchanged.

This applies to:

- single-row updates and deletes
- bulk row snapshots (`[{ id, version }]`)
- container actions such as delete-done, mark-all-done, reorder, and store deletion

**Why:** A pre-read followed by a blind write still races. The safety guarantee needs to live in the actual SQL predicate.

**Alternatives considered:**

- _Accept `version` for logging only_: rejected because it provides no protection.
- _Do a read, compare in application code, then blind update_: rejected because it still allows races between read and write.

### 4. Store deletion becomes snapshot-based and conditionally removes the container

**Decision:** The store delete contract SHALL carry the store version plus a snapshot of the groceries that were in the store when the user requested deletion. The server SHALL only delete or unassign those snapshot groceries, and SHALL delete the store only if it is empty after that work completes.

**Why:** This preserves groceries added to the store later and matches the user's intended scope at the time of the action.

**Alternatives considered:**

- _Delete every grocery currently in the store at delivery time_: rejected because late delivery can erase newly added groceries.
- _Never delete the store if any mismatch exists_: rejected because it over-penalizes benign late additions when the snapshot work can still be applied safely.

### 5. Existing near-safe contracts are upgraded instead of replaced

**Decision:** Mutations that already carry explicit state or snapshots, such as `groceries.toggle`, `groceries.markAllDone`, and `groceries.deleteDone`, will keep their overall shape. This change only adds the missing version enforcement and stale-scope guarantees behind those contracts.

**Why:** These endpoints are already close to the correct delayed-delivery semantics, so a smaller migration reduces churn in shared hooks and optimistic updates.

**Alternatives considered:**

- _Redesign every mutation shape from scratch_: rejected because it creates unnecessary client churn for contracts that are already mostly correct.

### 6. First rollout excludes all create-style mutations and mutable join lookups

**Decision:** All create-style mutations and mutable lookup joins SHALL stay off the first delayed-delivery allowlist. This includes grocery creation, recurring grocery creation, store creation, household creation, household join, and calendar item creation.

**Why:** Even if duplicate creation is unlikely in practice, rarity is not a safety guarantee. Late delivery can still create a second entity or resolve a different household than the user intended, so the first rollout stays focused on existing entity mutations whose safety can be enforced with explicit state, snapshots, and versions.

**Alternatives considered:**

- _Make create flows deterministic now_: rejected because it adds a larger cross-domain migration than the first rollout needs.
- _Allow creates because conflicts are unlikely_: rejected because delayed-delivery contracts must be predictable, not merely low-risk.

### 7. Stale delayed writes become logged no-ops in the first rollout

**Decision:** When a delayed request fails its version or snapshot preconditions, the server SHALL treat it as a safe no-op and log the stale outcome. The first rollout does not require structured receipts or explicit client-visible no-op payloads beyond existing logging.

**Why:** The user wants delayed delivery rather than replay receipts. Logged no-op behavior is enough to make stale requests safe without expanding this change into a larger transport protocol project.

**Alternatives considered:**

- _Bundle structured receipts or exactly-once delivery now_: rejected because it adds a larger infrastructure project and new storage concerns.
- _Silently swallow stale writes with no logging_: rejected because operators still need visibility into delayed requests that no longer apply.

### 8. Security-sensitive versioned mutations stay in scope

**Decision:** Security-sensitive mutations such as household leave, kick, regenerate-code, and admin-transfer SHALL remain in scope for the first delayed-delivery rollout if they satisfy the same explicit-target and version-enforced safety rules as other eligible mutations. `households.join` remains excluded with the create-style group because it still resolves a mutable join code at delivery time.

**Why:** These are still normal user-triggered state changes. If their contracts can be made predictable, excluding them would leave an avoidable safety gap in a mutation family the delayed-delivery system may eventually need.

**Alternatives considered:**

- _Exclude all security-sensitive actions for extra caution_: rejected because the same version and explicit-target protections apply here, and blanket exclusion would leave known unsafe writes unaddressed.

## Risks / Trade-offs

- **[Broad migration surface across many domains]** -> Mitigate with an audit matrix and staged implementation waves grouped by contract pattern.
- **[Payloads get larger when they carry snapshots]** -> Mitigate by limiting snapshots to `id` + `version` and only for destructive/container actions.
- **[Some delayed deliveries will become harmless no-ops instead of silently succeeding]** -> Mitigate with explicit stale logging and targeted tests so operators can see the behavior.
- **[Create flows may lag behind update/delete fixes]** -> Mitigate by introducing an explicit allowlist boundary so unsafe creates are not queued prematurely.
- **[Fire-and-forget router patterns can still hide business outcome details]** -> Mitigate by making stale requests safe by construction first; richer receipts remain a later enhancement.

## Migration Plan

1. Build a mutation audit matrix grouped into `safe`, `fixable now`, and `exclude for now`, using the inventory above as the starting point.
2. Update shared input schemas and client hooks to send explicit booleans and row snapshots for the approved first-rollout patterns, while codifying the create-style and repeat-work mutations that remain immediate-only.
3. Update repository write paths so version-aware mutations enforce compare-and-swap in SQL and bulk/container mutations scope work to the provided snapshot.
4. Adjust routers and emitters so late-delivery-safe mutations preserve the correct realtime/cache semantics after the contract changes.
5. Add regression coverage that simulates stale delayed delivery for representative domains: favorites, groceries, stores, a profile-style write, and allowlist exclusion checks for create-style or repeat-work paths that remain immediate-only.
6. Only after a mutation family satisfies the capability rules should it be marked eligible for delayed delivery in the future outbox work.

## Open Questions

None for the first rollout. Create-style mutations are excluded, stale delayed writes are logged no-ops, and security-sensitive versioned mutations remain in scope when they meet the same safety rules.
