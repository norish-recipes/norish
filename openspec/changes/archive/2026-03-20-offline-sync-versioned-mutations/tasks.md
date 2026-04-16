## 1. Schema and migration foundation

Owner-owned migration step: the repository owner, not the agent, will run the root `db:generate` script (`pnpm db:generate`) to create the Drizzle migration; the generated migration is then applied automatically on server start.

- [x] 1.1 Inventory mutable application tables and introduce a shared versioned-column helper/base where it reduces Drizzle schema duplication.
- [x] 1.2 Update schema definitions for non-null `version` columns and prepare the backfill expected from the owner-generated `pnpm db:generate` migration across the selected table inventory.
- [x] 1.3 Update repository write paths so successful authoritative row changes increment `version` exactly once.

## 2. Contract propagation

- [x] 2.1 Update generated zod schemas, handwritten DTOs, and realtime payload contracts so every versioned entity shape includes `version`.
- [x] 2.2 Update repository return types, tRPC read models, and shared consumers to preserve `version` through list, detail, and aggregate payloads.

## 3. Verification

- [x] 3.1 Add regression coverage for version initialization and increment behavior on representative mutable entity families.
- [x] 3.2 Add compile or contract-level verification for manual DTOs and payloads that now must carry `version`.
