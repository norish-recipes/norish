# 01 — Cuisine vocabulary and admin management

Status: ready-for-agent
Blocked by: None — can start immediately

Spec: `.scratch/recipe-provenance/spec.md`
Decision record: `docs/adr/recipes/0012-cuisines-are-curated-tags-are-not.md`

## What to build

An administrator can manage the deployment's Cuisine vocabulary from admin settings: see the list, add a Cuisine, rename one, and delete one. They can also choose the cuisine strategy that will later govern whether AI may extend the vocabulary or only pick from it.

The vocabulary ships seeded with a sensible starting list so a fresh deployment is usable immediately, and that seed happens exactly once — a Cuisine an administrator deletes stays deleted across restarts and upgrades.

Nothing consumes Cuisines yet. This ticket delivers the vocabulary and its governance; recipes start carrying Cuisines in ticket 04.

## Notes

A Cuisine name is a **canonical identifier**, not a translatable label — stored once, seeded in English, shown verbatim in every locale, with no translation keys and no seeded-versus-administrator distinction at render time. An administrator who wants names in their own language renames them. This is the same treatment AI-minted Tags already get.

The strategy setting deliberately does **not** reuse the tag strategy's value names: that enum has three values and its `predefined` mode names a compile-time list that has no cuisine equivalent. Use `existing` and `extend`, defaulting to `existing`.

Delete is a silent cascade — no usage count, no extra confirmation. Recipes referencing a deleted Cuisine simply lose it.

`Other` is deliberately not in the seed list. An empty Cuisine set already means "nothing in our vocabulary fits".

## Acceptance criteria

- [ ] A cuisines table and a recipe-to-cuisine join exist, mirroring the existing Tag structure.
- [ ] A versioned migration seeds the starting vocabulary exactly once; it does not re-run and is not a boot-time reconcile.
- [ ] A Cuisine deleted by an administrator does not reappear after a subsequent server start.
- [ ] All cuisine reads and writes are issued from the repository layer.
- [ ] An administrator can list, add, rename, and delete Cuisines from admin settings.
- [ ] Renaming a Cuisine writes one row and requires no recipe writes.
- [ ] Deleting a Cuisine cascades to the join rows and touches no recipe rows.
- [ ] A cuisine strategy setting exists with values `existing` and `extend`, defaults to `existing`, and is controllable from admin settings.
- [ ] The strategy setting is independent of any automatic-enrichment switch.
- [ ] Interface strings are added for every enabled locale and the internationalization gate passes.
- [ ] The `Cuisine` glossary entry in `CONTEXT.md` matches the shipped behaviour.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Attaching Cuisines to recipes, or any inference. That is tickets 04 and 02.
- Migrating existing cuisine Tags. That is ticket 06.
- Merging two Cuisines into one.
- Browsing or filtering recipes by Cuisine.
