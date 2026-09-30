# 16: One transaction per catalogue edit

**What to build:** The catalogue edits in `packages/shared-server/src/ingredients/catalogue.ts` (`addAlias`, `renameIngredient`, `setParent`, `markDistinct`, `mergeIngredients`, `moveAlias`, `removeAlias`, `deleteIngredient`) are spread across `packages/db/src/repositories/{ingredient-catalogue,ingredient-relocation,ingredient-aliases}.ts`, and several problems follow from that:
- **Rename:** `renameIngredient` makes two separate writes (`renameCatalogueIngredient`, then `insertCatalogueAlias`).
- **Permission check:** `assertMayEditIngredient` and the owner lookup run before and outside the write, and `moveAlias` and `removeAlias` repeat the same block.
- **Suggestion cleanup:** `setParent` and `markDistinct` call `deleteSuggestionFor` as a separate step afterwards.
- **Outcome strings:** repository functions return strings (`"missing"`, `"taken"`) that are mapped one-to-one onto `CatalogueEditError`.
- **Own transactions:** each repository function opens its own `db.transaction`, so nothing above them can make two of them one unit. Only `lockTree` and `lockIngredients` (`ingredient-relocation.ts`) already take a `DbTransaction`.

Use a shared transaction. Each edit in `catalogue.ts` opens one with the existing `withTransaction` (`packages/db/src/drizzle.ts`) and passes its `tx` to every repository call it makes. That includes the owner lookup, the lock, the write and the suggestion cleanup. The repository functions take a `DbTransaction` instead of opening their own. They return plain data (a row, a count, or null), and `catalogue.ts` decides which `CatalogueEditError` that means, so the error stays in shared-server. Each edit reports the Ingredient ids it changed, which is what 17 builds on.

**Blocked by:** none

**Status:** done, pending gates and review

- [x] Each edit runs in one `withTransaction`, and its repository calls take that `tx` rather than opening their own.
- [x] A rename that fails on the alias insert leaves the old name intact (test).
- [x] The owner lookup and permission check read through the edit's `tx`; the duplicated owner-and-policy block is gone.
- [x] Repository outcome string unions are gone; repositories return data, and `catalogue.ts` maps it to `CatalogueEditError`.
- [x] Each edit returns the Ingredient ids it changed.
- [x] Existing `packages/shared-server/__tests__/ingredients/*` tests pass against a real database.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- From the 2026-09-30 architecture review.
- 2026-09-30: chose a shared `tx` over moving each edit into `packages/db`. The edit logic and `CatalogueEditError` stay in shared-server, and repositories stay plain data access.
- 2026-09-30 implemented: constraint violations (a name taken, something pointing at a spelling) still reach `catalogue.ts` as thrown errors, since Postgres aborts the transaction on them; `refusedOn` maps the one statement that can raise each to its refusal. The rename race test became the rollback test (a trigger refuses the alias insert). Merge keeps its own locks, as the seed and backfill call it too, each in a `withTransaction`.
