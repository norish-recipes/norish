# 06 — Ingredient Linking, the sixth enrichment kind

**What to build:** "Link Ingredients to Steps" appears in the recipe's actions menu, and an admin switch (shipped off) enrolls it automatically for newly usable recipes. The run is a gap-filler in every case: it only writes to steps that have no Step Ingredients, so a person's own links are never replaced. Aggregates ("add the spices") bind one step to several lines; partial use ("half the water") binds a fractional share.

**Blocked by:** 03 — Step Ingredients foundation.

**Spec:** `.scratch/general-improvements/spec.md`

**Status:** done

- [x] The kind is registered through the standard Recipe Enrichment contract: queue, worker, admin-overridable prompt template, structured output schema, per-kind automatic switch (default off), actions-menu entry, lifecycle events.
- [x] The worker writes only to steps with zero Step Ingredients; heading rows are never linked; an empty claim is an unchanged success, not a failure.
- [x] A recipe with no ingredients or no steps skips as insufficient input.
- [x] Dual-system recipes get one semantic inference fanned out to each system's rows by ingredient line order.
- [x] Automatic failures stay quiet; a requested run's terminal failure is visible to the requester and re-runnable.
- [x] The hand-maintained client-side enrichment state maps include the new kind.
- [x] A new harness e2e suite covers: an aggregate step linking several lines; "half the water" rendering the computed amount; a pre-existing link left untouched while bare steps are filled.

## Comments

- Shipped in 8e570e9e. Registered through the full enrichment contract (queue, lazy worker, admin-overridable prompt, strict schema, per-kind switch shipped off, actions-menu entry, lifecycle events, both client state maps). Gap-filler: repository write inserts only into steps with zero refs, skips headings on both sides, empty claim is an unchanged success, no-ingredients/no-steps skips as insufficient input, one semantic inference fans out per system by line order. Harness e2e suite ingredient-linking.e2e.ts covers the aggregate, fractional, gap-filling, and reading-surface criteria.
