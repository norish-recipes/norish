# 14: The resolver owns the stale-reference retry

**What to build:** Every write path that resolves ingredient texts currently wraps "resolve, then write" in `retryOnStaleIngredient` itself (`packages/shared-server/src/ingredients/resolver.ts`). That happens in 8 non-test files: `trpc/src/routers/groceries/{groceries,recurring,groceries-helpers}.ts`, `stores/{aisles,products}.ts`, `recipes/recipes.ts`, and `shared-server/src/ingredients/{pantry,recipe-lines}.ts`. The only statement of the rule is a docstring ("`attempt` must resolve inside itself"). A path that skips the wrapper still typechecks, although ADR-0037 relies on the type system to catch a path that skipped the resolver. Routers also spread `...ingredient` columns into repository payloads (`recurring.ts:188`).

Deepen the resolver with one interface, for example `writeResolved(texts, actor, (refs) => write(refs))`, that owns the resolve, the write, stale detection and the retry. `retryOnStaleIngredient` and `isStaleIngredientReference` become private.

**Blocked by:** none

**Status:** done, pending gates and review

- [x] Every current caller goes through the new interface; the two helpers are no longer exported.
- [x] Routers no longer spread alias/ingredient columns into repository payloads.
- [x] A resolver test proves a write racing a merge retries once and lands on the surviving Ingredient.
- [x] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- From the 2026-09-30 architecture review. Extends ADR-0037's "one resolver" to the write as well.
- 2026-09-30 implemented as `writeResolved(resolve, write)` rather than `writeResolved(texts, actor, write)`: the writes resolve three ways (a text, a grocery name that may keep its recipe line's alias, a recipe payload), and passing the resolution in as a callback keeps each while making "resolve inside the attempt" the signature. The stale-reference predicate moved to `@norish/db/repositories/constraint-violation`, since the store lookup's `linkUnlessGone` needs it for a write that resolves nothing. Routers name `ingredientAliasId` and `ingredientId` in their payloads instead of spreading a resolve's answer.
