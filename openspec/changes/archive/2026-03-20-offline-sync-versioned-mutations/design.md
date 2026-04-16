## Context

Norish already propagates `operationId` from client mutations through tRPC context, queue boundaries, and realtime envelopes, but that transport correlation still has no durable concurrency token to compare against. Most mutable tables expose only `updatedAt`, many repository updates rewrite rows without increment semantics, and several shared DTOs are manual interfaces or payload shapes that would currently drop a row version even if the database stored one.

That makes the version foundation inconsistent before offline replay even starts. A mobile outbox can only compare safely if the server stores a monotonic version on every mutable entity the product edits and if every DTO that represents that entity actually surfaces the token.

## Goals / Non-Goals

**Goals:**

- Add explicit integer `version` columns to all Norish-owned mutable application tables instead of maintaining a first-wave allowlist.
- Increment versions on successful authoritative writes so the stored token is usable for future compare-and-swap contracts.
- Surface `version` through generated zod schemas, manual DTO interfaces, repository outputs, and realtime payloads for every versioned entity.
- Reuse a shared schema/helper pattern for versioned tables where Drizzle table definitions can share the same shape cleanly.
- Keep this change focused on the versioning foundation that later replay-safe mutation work will consume.

**Non-Goals:**

- Define replay-safe mutation outcomes, operation receipts, or toggle-migration behavior in this change.
- Build conflict-resolution UI or field-level merge tooling.
- Use `updatedAt`, transport headers, or client timestamps as the comparison token.
- Retrofit append-only logs, auth/session records, or other infrastructure tables that are not product-level optimistic-concurrency targets.

## Decisions

### 1. Version mutable application tables in one sweep

**Decision:** Norish SHALL add a non-null integer `version` to every application table whose rows can be updated or deleted through normal product workflows, rather than limiting the rollout to recipes, groceries, and planned items.

**Why:** The repo already has a broad set of mutable entity families. Doing this once avoids repeated migrations, partial DTO adoption, and follow-on work that has to rediscover which tables are version-ready.

**Alternatives considered:**

- Keep a first-wave allowlist: rejected because it preserves contract inconsistency and forces later schema churn.
- Use `updatedAt` as the universal token: rejected because timestamps are harder to compare strictly and easier to serialize inconsistently.

### 2. Reuse a shared versioned-column helper where it fits

**Decision:** Schema definitions SHOULD use a shared helper or base column object for `version` and related mutable-row metadata where Drizzle table declarations can reuse that shape without making the schema harder to read.

**Why:** Many tables already repeat the same timestamp columns. Adding `version` everywhere is a good point to centralize the shared mutable-row shape and reduce copy-paste drift.

**Alternatives considered:**

- Hand-add `version` to every table forever: rejected because it increases duplication and makes future consistency fixes harder.
- Force every table through one rigid base abstraction: rejected because some tables already diverge enough that a helper should stay optional.

### 3. Every DTO that represents a versioned row carries `version`

**Decision:** Shared contracts SHALL expose `version` anywhere a versioned entity is serialized, including drizzle-zod select schemas, handwritten DTO interfaces, and realtime payloads.

**Why:** Adding a column in the database is not enough if the version disappears at the contract boundary. The offline client needs the same token that the server stores, and manual DTO definitions are the easiest place to accidentally lose it.

**Alternatives considered:**

- Only expose versions on a small subset of read models: rejected because callers would still need special-case knowledge.
- Keep versions database-only until replay-safe writes land: rejected because it delays contract cleanup and makes the next change harder to stage.

### 4. Stored row versions are broader than future write boundaries

**Decision:** This foundation SHALL version rows broadly even when a later replay-safe write contract chooses a coarser aggregate boundary for compare-and-swap.

**Why:** Recipes may still use the recipe row as the main optimistic boundary, but versioning child rows now keeps the data model consistent and leaves room for future direct child edits or sync diagnostics.

**Alternatives considered:**

- Only version aggregate roots: rejected because it conflicts with the goal of making all mutable entity DTOs comparison-ready now.

### 5. Replay-safe mutation contracts move to a separate change

**Decision:** Structured outcomes, operation receipts, and replay-safe toggle migration SHALL be specified in a separate follow-on change that depends on this version foundation.

**Why:** Splitting the work keeps this change focused on durable schema and DTO groundwork while the next change can inventory unsafe mutations and migrate them in one coordinated sweep.

## Risks / Trade-offs

- **[Broad schema and contract churn]** -> Mitigate with a shared helper, table inventory, and compile-driven DTO updates.
- **[Manual DTOs or payloads miss the new field]** -> Mitigate with an explicit inventory of handwritten contracts and targeted tests around representative payloads.
- **[Broad row versioning could be mistaken for immediate compare-and-swap scope]** -> Mitigate by documenting that write-boundary rules come from the follow-on replay-safe contract change.

## Migration Plan

1. Inventory mutable application tables and prepare the schema changes; the repository owner, not the agent, will generate the migration via the root `db:generate` script (`pnpm db:generate`), and the existing server startup migrator will apply that generated migration automatically on start.
2. Update schema helpers, generated zod schemas, manual DTOs, realtime payloads, and repository outputs so `version` is surfaced end to end.
3. Add verification for version initialization and increments on representative row families, leaving replay-safe mutation contracts to the follow-on change.
