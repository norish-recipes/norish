# 01: Bulk recipe delete on the server

**What to build:** `recipes.delete` takes a list of `{ id, version }` and replaces the single-recipe form (it is not in the OpenAPI surface, so no shim). Each recipe is handled on its own:

- access is checked per recipe under the existing delete permission policy, Orphaned recipes included; denied ones are skipped;
- a recipe whose version no longer matches is kept;
- a recipe that no longer exists counts as deleted.

The procedure awaits the database work and returns the deleted and kept ids, so Replay sees a real outcome. It no longer returns before doing the work. Image directories are removed after commit, and only for recipes actually deleted. Today they are removed before the version check, so a stale delete wipes a surviving recipe's images.

It publishes one Realtime Event for the deleted ids and one telling the caller which recipes were kept as stale. The client shows "N recipes were changed by someone else and kept." and refetches. The repository gains a bulk delete that checks each version and reports deleted versus stale, like the grocery bulk delete.

The recipe card and the recipe page pass one item. The two near-duplicate delete-recipe modals fold into one shared modal.

See `.scratch/library-selection/spec.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Own commit first: a failing tRPC test showing a stale delete removes the surviving recipe's images, then the fix
- [ ] tRPC tests: many items with per-recipe permission, stale kept, missing counted as done, returned ids, published events
- [ ] Repository test: bulk delete checks each recipe's version against the real database and reports deleted vs stale
- [ ] Single delete from the card and the recipe page still works, through the one shared modal
- [ ] Kept-as-stale event produces the terse toast and a refetch
- [ ] Gates green: lint, typecheck, test:run, i18n:check, build
