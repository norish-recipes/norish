## Why

Mobile offline replay needs a stable concurrency token on every mutable entity, but Norish still relies mostly on timestamps and many shared DTOs drop that state entirely. Adding versions broadly now avoids repeated schema churn later and gives the replay-safe mutation work a consistent contract to build on.

## What Changes

- Add non-null integer `version` columns to all Norish-owned mutable application tables; the repository owner, not the agent, will generate the migration with the root `db:generate` script (`pnpm db:generate` -> `pnpm --filter @norish/db exec drizzle-kit generate --config ./src/drizzle.config.ts`), server startup will apply the generated migration automatically, existing rows will backfill to `1`, and successful authoritative writes will increment versions thereafter.
- Introduce a shared schema/helper pattern for versioned tables where Drizzle definitions can reuse it cleanly instead of hand-adding the same column everywhere.
- Surface `version` through shared read contracts, manual DTO interfaces, realtime payloads, and repository return shapes for every versioned entity.
- Narrow this change to the versioning foundation only; replay-safe mutation contracts, structured outcomes, toggle migration, and operation receipts move to a separate change.

## Capabilities

### New Capabilities

- `entity-version-contracts`: Monotonic version columns and compare-friendly DTO exposure for Norish mutable entities.

### Modified Capabilities

None.

## Impact

- `packages/db` schema definitions, migrations, and repositories that create or update mutable rows
- `packages/shared` DTOs, zod schemas, and realtime payload contracts that represent mutable entities
- `packages/trpc` procedures and read models that return versioned entities
- Web, mobile, and shared React consumers that compile against version-aware DTOs
