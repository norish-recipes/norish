## 1. Audit and delayed-delivery classification

- [x] 1.1 Build a mutation audit matrix covering favorites, ratings, groceries, recurring groceries, stores, households, calendar, recipes, user/profile, CalDAV, and site-auth-token write paths.
- [x] 1.2 Mark each audited mutation as `already-safe`, `migrate-now`, or `exclude-for-now`, and define the first delayed-delivery allowlist from that matrix.

## 2. Explicit final-state and snapshot contract updates

- [x] 2.1 Replace backend-derived toggle-style inputs with explicit final-state inputs for `favorites.toggle` and any other delayed-delivery-compatible toggle paths.
- [x] 2.2 Extend `stores.delete` to accept the store version plus a grocery snapshot, and update the related shared client hooks to send that payload.
- [x] 2.3 Preserve the existing explicit-state/snapshot grocery contracts (`toggle`, `markAllDone`, `deleteDone`) while tightening their end-to-end version and scope requirements.

## 3. Version-enforced repository and router writes

- [x] 3.1 Enforce compare-and-swap SQL predicates for grocery, recurring grocery, store, and rating mutation repositories that currently ignore supplied versions.
- [x] 3.2 Enforce compare-and-swap SQL predicates for household, calendar, recipe, user/profile, CalDAV, and site-auth-token mutation repositories that currently ignore supplied versions.
- [x] 3.3 Update routers and emitters so stale delayed writes become safe no-ops and never overwrite newer rows or broaden destructive scope.

## 4. First-rollout allowlist boundaries

- [x] 4.1 Mark grocery create, recurring grocery create, store create, household create, household join, and calendar item create mutations as excluded from the first delayed-delivery allowlist.
- [x] 4.2 Mark repeat-work mutations such as `caldav.triggerSync` and `syncAll` as excluded from the first delayed-delivery allowlist until a later deterministic contract exists.
- [x] 4.3 Keep security-sensitive versioned mutations such as household leave, kick, regenerate-code, and admin-transfer in scope and migrate them with the same safety rules as other eligible mutations.

## 5. Client contract and optimistic update alignment

- [x] 5.1 Update shared zod contracts and shared-react hooks so migrated mutations always send explicit states, versions, and snapshots required by the new safety rules.
- [x] 5.2 Update optimistic cache logic in affected clients so local state mirrors the final-state and snapshot semantics of the migrated mutations.

## 6. Verification

- [x] 6.1 Add regression tests for explicit final-state behavior and stale version mismatches on representative mutations such as favorites, ratings, and grocery row updates, including logged no-op outcomes.
- [x] 6.2 Add regression tests for snapshot-based destructive mutations, including delete-done and store delete preserving later-added groceries.
- [x] 6.3 Add verification that only the approved migrated mutation families are included in the first delayed-delivery allowlist and that excluded create-style and repeat-work mutation families remain immediate-only.
