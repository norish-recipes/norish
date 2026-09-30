# 17: Catalogue edits announce the Ingredients they changed

**What to build:** `packages/trpc/src/routers/ingredients/index.ts` (21 procedures) calls `announceChanged` 12 times. Each procedure has to know which Ingredients an edit touched: a merge touches source and target, and `moveAlias` returns `fromIngredientId` only for this purpose. Refusal mapping (`asEditResult`, `REFUSAL_CODES`, ad hoc `CatalogueEditError` catches) lives there too. `suggestions.ts` has to repeat the same knowledge (`confirmSuggestion` returns the changed ids only so the router can announce them), and a forgotten announcement leaves other screens silently stale. `catalogue.test.ts` can't catch that, because the announcement happens outside the catalogue module.

The catalogue edits publish their changed Ingredient ids through a publisher port they're given, with a realtime adapter in production and an in-memory adapter in tests. The router shrinks to auth context plus error translation.

**Blocked by:** 16

**Status:** done, pending gates and review

- [x] No router or queue path calls `announceChanged` for a catalogue edit.
- [x] `catalogue.test.ts` asserts the changed ids for merge, move-alias and set-parent through the in-memory publisher.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- From the 2026-09-30 architecture review. Builds on 16, where each edit already works out which ids it changed.
- 2026-09-30 implemented: the port is `shared-server/src/ingredients/changes.ts` (`ingredientChanges()`, swapped in tests with `publishIngredientChangesTo`). Every edit announces after its transaction commits; dismissing a suggestion announces too. The router still announces after a single-food Ask AI or Find parent, which records a suggestion rather than editing the catalogue, now through the same port; the review round keeps its one announcement at the end.
