# 11: The browser E2E suite reaches the database through the app, not raw SQL

**What to build:** The browser E2E suite (`apps/web/__tests__/e2e/`) sets up its data and checks results with about 130 raw SQL queries over `pg`, across 28 files: users, recipes, foods, spellings, recipe lines, groceries, the Pantry, cookbooks, server config, and the reads that check what changed. None go through the repository layer, so each schema change means hand-editing SQL in test files. Ticket 03 had to rewrite three copies of the recipe-line insert.

Every E2E read and write goes through the app instead: tRPC as a signed-in reader where the app offers it (`callTrpc` / `queryTrpc` in `harness/trpc.ts`, as the nutrition spec's `lineIngredient` already does), and repository functions where it doesn't, such as backdating a mark or forcing a rung version. Calling repositories from the E2E process means pointing `@norish/db` at each worker's own database before its first use.

**Blocked by:** 01–10, so the suite moves once the data model stops changing.

**Status:** done

- [x] No E2E file holds raw SQL; `pg` is imported only where the harness wires the repository layer to a worker's database.
- [x] Each worker's repository calls reach that worker's database and no other.
- [x] All E2E suites stay green, and all `CONTRIBUTING.md` gates pass.

## Comments

2026-10-20, done.

- `pg` is gone from apps/web: no E2E file imports it, and `apps/web/package.json` no longer lists it. `ProductionStack.start()` points the worker's repositories at its own database (`harness/repositories.ts`), and `stop()` points them back at an unreachable URL. `playwright.config.ts` sets the environment `@norish/config` parses, so a call made before the stack exists fails instead of reaching a developer's database.
- Reads and writes go through tRPC as the signed-in reader where a procedure does the same thing (73 calls). Repositories stay where the app has no route, or where tRPC cannot give the scenario what it needs:
  - seeding past the resolver and AI (`harness/recipes.ts` `seedRecipe`, the nutrition seed foods, seeded spellings in their own languages);
  - cross-owner name lookups;
  - households for other accounts;
  - the rung-version and prompts config rows;
  - media placed on disk;
  - the newest grocery of a name;
  - a single step link;
  - taking back a rating;
  - store preferences;
  - the scenario resets (`harness/reset.ts`).
- New repository functions, each with a db test: `findNewestGroceryNamed`, `removeRating`, `attachStepIngredient` (with the `StepIngredientLink` type), and `insertSeededIngredient`.
- Going through the app found three bugs, each fixed in its own commit with a failing test first:
  - A mint of a name an Ingredient already had reset that Ingredient's parent and flag: the `spelled` subquery bound to the alias table's own id.
  - Deleting a Store along with its groceries never deleted the Store: `count(*)` came back as the string `"0"`. Every repository count is now `::int`.
  - A realtime subscription whose Redis read failed while opening ended with `INTERNAL_SERVER_ERROR` instead of Lagged, which left the tab deaf after a Redis restart.
- JSON imports in package sources now carry `with { type: "json" }`, because Node's own loader (Playwright) requires it.
- Full `pnpm run test:e2e` is green, and lint, typecheck, test:run, i18n:check, format:check and deps:cycles pass.
