## Why

`packages/api` and `packages/shared-server` contain 27 duplicated files (~4,800 lines) that diverged only in import paths during the original monorepo extraction. The duplication causes two separate Pino logger instances at runtime, inflates the bundle, makes bug-fixes error-prone (patches must be applied in two places), and violates the enforced dependency-direction spec (`dependency-boundaries`). Consolidating now prevents further drift and unblocks `packages/queue` and `packages/auth` from depending on a single canonical source for AI foundations, media ops, and CalDAV helpers.

## What Changes

- **Delete 21 forked files from `packages/api/src/`** that are near-identical copies of files already in `packages/shared-server/src/` and re-export or import from `@norish/shared-server` instead.
- **Add missing `@norish/shared-server` exports** for any module that is currently only exported by `@norish/api` but belongs in the shared layer (e.g. `ai/helpers`, `ai/prompts/loader`, `ai/schemas/conversion.schema`, `ai/types/result`, `caldav/ics-helpers`).
- **Rewire all consumers** (`packages/api`, `packages/queue`, `packages/auth`, `packages/trpc`) so they import infrastructure symbols from `@norish/shared-server` rather than `@norish/api` where the code has moved.
- **Merge minor code-style drift** (optional chaining, loop style, non-null assertions) into the `shared-server` canonical copy before deleting the `api` fork.
- **Ensure a single Pino logger instance** across the server process by centralising the logger in `shared-server` and removing the duplicate in `api`.

### Files deleted from `packages/api/src/`

| Zone            | Files deleted (api path)                                                                                                                                                                                                                                         | Canonical location (shared-server)                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logger          | `logger.ts`                                                                                                                                                                                                                                                      | `logger.ts`                                                                                                                                                                                         |
| Media           | `downloader.ts`                                                                                                                                                                                                                                                  | `media/storage.ts`                                                                                                                                                                                  |
| AI foundations  | `ai/helpers.ts`, `ai/prompts/loader.ts`, `ai/providers/factory.ts`, `ai/providers/index.ts`, `ai/providers/listing.ts`, `ai/providers/types.ts`, `ai/schemas/conversion.schema.ts`, `ai/types/result.ts`, `ai/unit-converter.ts`, `ai/utils/category-matcher.ts` | `ai/*` (same relative paths)                                                                                                                                                                        |
| CalDAV          | `caldav/client.ts`, `caldav/ics-helpers.ts`                                                                                                                                                                                                                      | `caldav/client.ts`, `caldav/ics-helpers.ts`                                                                                                                                                         |
| Archive parsers | `importers/archive-parser.ts`, `importers/mealie-legacy-parser.ts`, `importers/mealie-parser.ts`, `importers/mela-parser.ts`, `importers/paprika-parser.ts`, `importers/parser-helpers.ts`, `importers/tandoor-parser.ts`                                        | `archive/parser.ts`, `archive/mealie-legacy-parser.ts`, `archive/mealie-parser.ts`, `archive/mela-parser.ts`, `archive/paprika-parser.ts`, `archive/parser-helpers.ts`, `archive/tandoor-parser.ts` |
| Lib             | `lib/workspace-paths.ts`                                                                                                                                                                                                                                         | `lib/workspace-paths.ts`                                                                                                                                                                            |

### Files that stay in `packages/api/src/` (unique domain logic)

- `ai/allergy-detector.ts`, `ai/auto-categorizer.ts`, `ai/auto-tagger.ts`, `ai/core/*`, `ai/features/*`, `ai/image-recipe-parser.ts`, `ai/nutrition-estimator.ts`, `ai/recipe-parser.ts`, `ai/transcriber.ts`, `ai/prompts/builder.ts`, `ai/prompts/fragments/*`, `ai/schemas/auto-tagging.schema.ts`, `ai/schemas/nutrition.schema.ts`, `ai/schemas/recipe.schema.ts`
- `caldav/event-listener.ts`, `caldav/household-deduplication.ts`, `caldav/sync-manager.ts`
- `lib/domain-matcher.ts`
- All of `parser/*`, `video/*`, `helpers.ts`

## Capabilities

### New Capabilities

- `server-code-deduplication`: Consolidation of duplicated infrastructure and foundation modules between `packages/api` and `packages/shared-server` into a single canonical location, with updated import paths across the monorepo.

### Modified Capabilities

- `dependency-boundaries`: Consumer packages (`queue`, `auth`) will shift some imports from `@norish/api` to `@norish/shared-server`, reducing back-edges to the api package and better aligning with enforced dependency direction.

## Impact

- **`packages/shared-server`** — gains new exports; some files receive minor fixes merged from the `api` fork (optional chaining, loop style).
- **`packages/api`** — 21 files deleted; remaining domain files re-import from `@norish/shared-server`; `package.json` gains `@norish/shared-server` as an explicit dependency (already declared but unused until now).
- **`packages/queue`** — logger & downloader imports shift from `@norish/api` to `@norish/shared-server`.
- **`packages/auth`** — logger imports shift from `@norish/api` to `@norish/shared-server`.
- **`packages/trpc`** — already imports from `@norish/shared-server`; no change expected.
- **Tests** — `vi.mock()` paths in `packages/api/__tests__/` must update to `@norish/shared-server/*`.
- **Runtime** — single Pino logger instance instead of two; no functional behaviour change.
