## Context

During the original monorepo extraction, several modules were copied from a single-app codebase into both `packages/api` and `packages/shared-server`. The intent was for `shared-server` to be the canonical home for reusable server infrastructure, but the `api` copies were never removed. Over time the two copies drifted minimally (import paths, minor code-style) while remaining functionally identical.

Today, 27 files (~4,800 lines) are duplicated across 5 zones: logger, media/downloader, AI foundations, CalDAV client/helpers, archive parsers, and workspace-paths. No package currently imports infrastructure from `@norish/shared-server` into `@norish/api`; instead, `packages/queue` and `packages/auth` import these same utilities via `@norish/api`, creating unnecessary back-edges.

## Goals / Non-Goals

**Goals:**

- Eliminate all file-level duplication between `packages/api/src` and `packages/shared-server/src`.
- Establish `@norish/shared-server` as the single source of truth for reusable server infrastructure (logger, media ops, AI foundations, CalDAV client, archive parsers, workspace-paths).
- Reduce dependency back-edges: `packages/queue` and `packages/auth` should import infrastructure from `@norish/shared-server` instead of `@norish/api`.
- Merge any code-quality improvements from the `api` fork (optional chaining, loop style) back into `shared-server` before deleting duplicates.
- Keep a single Pino logger instance across the server process.

**Non-Goals:**

- Moving domain-specific AI features (recipe-parser, transcriber, auto-tagger, etc.) out of `packages/api` — these are domain logic, not shared infrastructure.
- Restructuring the overall monorepo package layout beyond deduplication.
- Changing any public API or runtime behaviour.
- Moving CalDAV orchestration (sync-manager, event-listener) to `shared-server` — these have domain-specific dependencies.

## Decisions

### D1: shared-server is the canonical owner for all infrastructure modules

**Decision**: All duplicated files consolidate into `packages/shared-server`. The `packages/api` copies are deleted.

**Rationale**: `shared-server` was already designed for this purpose and already has exports for most of these modules. The `api` package should contain domain logic only. This aligns with the existing `dependency-boundaries` spec which enforces one-way dependency direction.

**Alternative considered**: Create a new `packages/server-infra` package. Rejected — adds workspace overhead with no benefit over the existing `shared-server` package.

### D2: Merge code-style drift into shared-server before deletion

**Decision**: Where the `api` copy has minor improvements (optional chaining, `for...of` loops, non-null assertions), adopt those improvements in the `shared-server` copy before deleting the `api` file.

**Rationale**: The `shared-server` copy sometimes has slightly safer patterns (optional chaining), while the `api` copy sometimes has cleaner loop style. Cherry-pick the best from each rather than blindly keeping one.

### D3: Add missing exports to shared-server package.json

**Decision**: Add export entries to `packages/shared-server/package.json` for all modules that `api` or other consumers need:

New exports needed:

- `./ai/helpers`
- `./ai/prompts/loader`
- `./ai/providers/factory` (consumers import individual providers)
- `./ai/providers/listing`
- `./ai/providers/types`
- `./ai/schemas/conversion.schema`
- `./ai/types/result`
- `./caldav/ics-helpers`

**Rationale**: These modules exist in `shared-server/src` but lack export entries. Without exports, consumers can't import them via `@norish/shared-server/...`.

### D4: Rewire consumer imports in a single sweep

**Decision**: Update import paths in `packages/api`, `packages/queue`, `packages/auth`, and test files in a single pass per zone, proceeding zone-by-zone (logger → media → AI → CalDAV → archive → workspace-paths).

**Rationale**: Zone-by-zone allows incremental type-check validation. Each zone can be verified independently before moving to the next.

### D5: archive-parser.ts stays in api as a thin orchestrator

**Decision**: `packages/api/src/importers/archive-parser.ts` is not a pure duplicate — it imports DB repositories and orchestrates the full import workflow. However, since `packages/shared-server/src/archive/parser.ts` has nearly identical code (466 vs 462 lines, 35 diff lines), the canonical detection/parsing logic stays in `shared-server` and `api` keeps a thin orchestrator that calls into `@norish/shared-server/archive/parser` for format detection and parsing, then handles the DB persistence layer.

**Rationale**: The parser.ts in shared-server handles format detection and recipe extraction without DB dependencies. The archive-parser.ts in api combines parsing with DB writes. The common parsing logic should live in shared-server; the DB orchestration stays in api.

### D6: Logger consolidation strategy

**Decision**: Delete `packages/api/src/logger.ts` and have all consumers import from `@norish/shared-server/logger`. The doc-comment import path reference is the only difference.

**Rationale**: Two separate Pino instances means two logger configurations, potential double-initialization, and inconsistent log formatting. A single instance from `shared-server` is simpler and more predictable.

## Risks / Trade-offs

**Risk: Import path breakage in untested consumer code** → Mitigation: Full TypeScript type-check (`pnpm typecheck`) after each zone validates all import paths resolve correctly.

**Risk: Test mocks reference old paths** → Mitigation: `vi.mock()` paths in test files are explicitly updated alongside source imports. grep for `@norish/api/logger`, `@norish/api/downloader`, etc. in test files.

**Risk: Turborepo cache invalidation** → Mitigation: After changing `shared-server/package.json` exports, run `pnpm build` to ensure build cache is properly invalidated. This is a one-time cost.

**Risk: packages/queue gains new dependency on @norish/shared-server** → Mitigation: This is already a more correct dependency direction (queue → shared-server instead of queue → api). Add `@norish/shared-server` to queue's `package.json` if not already present.
