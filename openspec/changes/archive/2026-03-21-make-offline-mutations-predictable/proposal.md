## Why

Norish's delayed-delivery mobile outbox will send some mutations after the user originally triggered them, but many current write contracts are only safe when executed immediately. Backend-derived toggles, broad bulk deletes, and repositories that ignore entity versions can apply stale intent to the wrong current state, so we need predictable mutation contracts before delayed delivery ships.

## What Changes

- Audit all mutable endpoints that a delayed-delivery mobile outbox could send and classify them as already-safe, migrate-now, or exclude-for-now under delayed delivery.
- Replace unsafe mutation shapes with explicit-intent contracts, such as `set` semantics instead of backend-decided toggles.
- Require bulk destructive mutations to carry a client snapshot (`id` + `version`) of the rows the user actually saw, so delayed delivery only affects that original set and preserves rows added later.
- Enforce optimistic version checks in repository-backed mutation paths that currently accept versions but ignore them, returning deterministic stale/conflict outcomes instead of silently applying outdated writes.
- Keep all create-style mutations and repeat-work triggers out of the first delayed-delivery allowlist, while migrating the unsafe versioned update/delete, toggle, snapshot-delete, and security-sensitive household/admin mutation families that can be made predictable now.
- Keep this change narrowly focused on mutation contract safety for delayed delivery; it does not add the outbox itself, replay failed operations, introduce new tables, or validate that a later emitted event proved business success.

## Capabilities

### New Capabilities

- `delayed-delivery-mutation-safety`: Contract rules, mutation inventory, and stale-write protections that make delayed mobile delivery predictable without replay-specific workflow changes.

### Modified Capabilities

None.

## Impact

- `packages/shared` mutation input schemas and DTOs for any affected write contract
- `packages/db` repositories that currently ignore versions or derive destructive scope from live server state
- `packages/trpc` routers that need new explicit-intent inputs, stale/conflict handling, or snapshot-based bulk semantics
- `packages/shared-react` hooks and optimistic update logic for affected mutations so clients send deterministic payloads
- Mobile delayed-delivery planning, which can rely on these contracts without introducing new backend tables or replay receipts in this change
