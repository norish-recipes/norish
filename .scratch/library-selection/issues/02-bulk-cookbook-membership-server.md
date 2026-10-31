# 02: Bulk cookbook membership on the server

**What to build:** `cookbooks.create` takes `recipeIds` (possibly empty) in place of the single optional `recipeId`. Ids that no longer exist or that the creator cannot see are skipped, and the cookbook is still created.

Cookbook membership gains a bulk add and a bulk remove: one cookbook, many recipe ids. They use the same rule as the single membership change (view on each recipe, edit on the cookbook). The add stays idempotent for recipes already in the cookbook, and each call publishes one Realtime Event carrying all the changed ids.

Callers move over:
- the cookbook's add-recipes panel and its edit panel's bulk remove drop their per-recipe loops;
- MiniCookbooks' "new cookbook from this recipe" passes one id;
- the empty create passes none.

Optimistic updates follow the existing patterns (membership counts, keep the tentative state when Queued). Offline, each call is one Outbox entry.

See `.scratch/library-selection/spec.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] tRPC tests: create with recipeIds skips missing/invisible recipes; bulk add/remove enforce permissions, add is idempotent, one event per call
- [ ] Adding several recipes from the cookbook page is one request (one Outbox entry offline)
- [ ] Removing several in the edit panel is one request; taking the last recipe out leaves the cookbook in place
- [ ] MiniCookbooks still creates a cookbook holding the current recipe
- [ ] Gates green
