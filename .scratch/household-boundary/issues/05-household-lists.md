# 05: Tags, Cuisines and Categories are household lists

**What to build:** Each household has its own Tags, Cuisines and Categories, unique on the folded name, plus the instance entries: the four built-in Categories and the administrator's Cuisines. A recipe carries only its household's entries and the instance's. Entries stay until deleted, households may add Cuisines, and allergies become plain names. See the spec, "Tags, Cuisines and Categories", and ADR-0043.

**Blocked by:** 03

**Status:** done

- [x] **Columns:** `tags`, `cuisines` and `categories` get `household_id` (null means an instance entry), unique on `foldName(name)` within a household and among instance entries.
- [x] **Migration:**
  - Shared Tag and Category rows are split, giving each household a copy of what its recipes use. The household that created the row keeps the original id.
  - Built-ins and today's Cuisines become instance entries.
- [x] **Repositories** (`packages/db/src/repositories/tags.ts`, `categories.ts`, `cuisines.ts`):
  - find-or-create works inside the recipe's household;
  - attaching refuses an entry from another household;
  - `deleteOrphanedTagsTx` and `deleteOrphanedCategoriesTx` go;
  - rename-onto-existing merges (revive `updateTagName` for all three);
  - delete detaches from the household's recipes.
- [x] **New procedures** for list, add, rename, merge and delete, for every member of the household. Instance entries are admin-only; built-in Categories refuse every change. These replace `admin.cuisines.*` (`packages/trpc/src/routers/admin/cuisines.ts`).
- [x] **Lists** (`packages/trpc/src/routers/config/procedures.ts`): `config.tags`, `config.categories` and `config.cuisines` return the household's entries plus the instance's, whatever the policy. Library filters at view Everyone match on the folded name across households.
- [x] **AI and imports:**
  - the `predefined_db` tag strategy injects the recipe household's Tags;
  - the `freeform` tag and `extend` cuisine strategies (`packages/shared-server/src/ai/enrichment/provenance-inferrer.ts`) match the household's list (fold, then `cuisine-resolver`'s near-match) before creating, and create in the recipe's household;
  - imports match the same way, and `category-matcher` keeps unmatched Categories as Tags.
- [x] **Allergies:**
  - `user_allergies` stores a name instead of a `tag_id`;
  - warnings match on the folded name against any recipe's Tags;
  - allergy detection writes into the recipe's household list.
- [x] **Realtime:** list changes publish on the household channel.
- [x] **Tests:**
  - repository tests for uniqueness per household and the refused foreign attach;
  - a migration test on two households sharing "soja";
  - E2E: household A's Tags are never offered to household B under view Everyone, but B sees them on A's recipes and can filter by one.

## Comments

- Fold: `entryFold(name)` (`foldName`, or the trimmed name when nothing folds, "🔥") is stored in `name_fold`, NOT NULL, unique per household (`uq_*_household_fold`) and among instance entries (`uq_*_instance_fold`); only `repositories/list-entries.ts` writes the three tables, always with the fold. Migration 0092 folds ASCII names in SQL (exact: case, `^`/`` ` `` dropped, the rest separators) and keys any other name, or one folding like a sibling, as `" <id>"`; the 0.28 boot upgrade (`before-0-28-household-lists.ts`, `UPGRADES_VERSION` 2) folds those with `entryFold` and merges alike-folding rows. "BBQ"/"bbq" could not both exist under the old `lower(name)` index, so the fixture uses "Gluten-free"/"gluten free" and "Café"/"cafe".
- Migration rules: a Tag or Category goes to the household of the oldest recipe carrying it (created_at, id) and keeps its id; every other household gets a copy and its recipes are re-pointed; a row no recipe carries is deleted (only an allergy or a missed sweep kept it; the allergy keeps the name); of rows folding alike the older survives and its recipes merge without duplicate links; built-ins and all Cuisines are instance rows; allergies take their Tag's name (`user_allergies` PK is user + name; a Tag's deletion always cascaded its allergies, so none is orphaned). No stored setting holds list ids (filters and Recent Searches hold names), so nothing else converts.
- Procedures (`lists.*`): `list({ kind, recipeId? })` answers `{ id, name, instance, version, recipeCount, editable }`, the household's entries plus the instance's, `recipeCount` counting the household's recipes; `add({ kind, name, recipeId?, instance? })` answers `{ entry, created }` (an existing fold, the instance's included, answers that entry); `rename` (merges onto a name the list has, `merged`), `merge({ sourceId, targetId })`, `delete` (answers `{ detached }`). `recipeId` checks edit access and works on that recipe's household. Instance entries: admins, Cuisines only; built-in Categories refuse everything. `admin.cuisines.*` is gone; the admin form uses `lists.*` until ticket 11. Household changes publish `lists.changed` on the household channel, instance changes `config.changed`.
- Attach: names resolve in the recipe's household (`recipeHouseholdId`), instance entries first; Cuisine ids must be the recipe's household's, the instance's, or already on the recipe, else `ForeignHouseholdReferenceError` (answered NOT_FOUND). AI `freeform` and imports match Tags with `matchNamesToList` (fold, then the cuisine-resolver near-match); `extend` creates Cuisines in the recipe's household; imports attach only Cuisines the household's list has.
- Ticket 09 must re-home: a leaver's recipes keep links to the old household's Tags, Categories and household Cuisines (no constraint blocks the move; reads show the names; the next edit re-creates Tags and Categories in the new household, and keeps carried Cuisines).
  - After re-homing, no recipe carries another household's entry; prove it with a test, and check deleting a household's last member with such links.
- Still on member ids: `ctx.userIds` only for `actorOf` (the catalogue actor, ticket 07); `householdMemberIdsSql` for household favourite/rating counts in random picks and `getHouseholdMemberIdsByUserId` for CalDAV dedup (account rows); the roster cache for the WS context, export and media session. `getHouseholdMemberIdsByHouseholdId` is gone.
- Search suggestions and Discover offer only the reader's household's entries and the instance's; an entry counts every visible recipe carrying its fold, in any household. Repository layer: nothing outside `packages/db` read or wrote these tables; db tests now seed through `attachTestEntry`. Not done: the E2E spec typechecks and lints but was not run.
- Boot fold: names 0092 could not fold keep the placeholder `" <id>"` until `upgradeHouseholdLists` succeeds. It runs at every boot outside the once-per-version pass, one transaction per kind, until none waits. Until then the server serves: such a name matches no filter, suggestion or find-or-create by its fold, so a write may create a twin, which the next successful fold merges into the older entry.

Review round 1:

1. Fixed: one name schema per kind (`ListEntryNameSchemas`: Tags unbounded as recipes take them, Cuisines 80, Categories 40) for lists and recipe writes; reads take any stored name.
2. Fixed: the join guard counts Tags, Categories and Cuisines.
3. Fixed: suggestions and Discover offer the reader's and the instance's entries, counted over visible recipes by fold.
4. Fixed: rename, merge and delete take versions and answer `stale`; a merge bumps the target's version.
5. Fixed: imports read the importer's household and allergy detection the recipe's when the job runs.
6. Fixed: procedures, recipe saves, deletes, enrichment and imports publish `lists.changed` to the household read at publish; both events reread lists, recipes, Library and Search.
7. Fixed: imports near-match the household's Categories; Cuisine matching folds emoji-only names.
8. Fixed (verified: an earlier step's throw skipped it): the fold runs at every boot until done; see Boot fold above.
9. Fixed: E2E checks suggestions and Discover, with a pair that needs the fold.
10. Fixed: unused schemas, DTOs, exports and `getRecipeTagNames` removed.
11. Fixed: one scope condition, link insert, fold lookup, row mapping and `entryName`.
12. Fixed: callers use the list repository; the one-line delegates are gone.
13. Fixed: `list-match.ts` is the one matcher; `withEditable`; `entriesByFoldTx`.
14. Partly: `ATTACH_ATTEMPTS` named; `required` kept, as the Tag filters pass the fold count under All (`library.ts`, `recipes.ts`).
15. Fixed: one `saved` path in `useCuisineMutations`.
16. Fixed: those comments are two lines.

Moved to ticket 09: list changes reaching a leaver's recipes and the foreign keys behind them. Moved to ticket 06: a save re-creating a deleted name, the cross-household editor's Cuisines. Rejected: request ordering around a membership move, exact-fold Cuisine import (ADR-0022), allergy names compared by fold, shared SQL fragments inside packages/db, over-long names. Asked of the maintainer: hand-written SQL in list-entries.ts.

Review round 2:

1. Fixed: filters, recipe saves and archive reads take any stored Category name; only a new entry is bounded (`LIST_NAME_MAX`).
2. Fixed: `entriesByFoldTx` creates no entry over its kind's bound (debug log); the recipe's other entries still save.
3. Fixed: `sortSourceCategories` keys by `entryFold`; a Norish archive's Categories match the household's by fold, then near-match.
4. Fixed: `lists.changed` is policy-scoped, published to the household's `policyAudience` at publish, kinds only.
5. Fixed: E2E asserts Discover offers exactly the reader's own Tag.
6. Fixed: the list announce is asserted once the create answers, before the after-commit wait.

Rejected: attach or detach not bumping the entry version; queue-time matching when the importer moves before the job runs; an extra announce from the extend strategy.

Final review, server round:

- Fixed (22bddda6c): manual allergy detection asks about the recipe's household's allergies.
- Fixed (667b7bde4, df322f3c3): instance entries first everywhere. An instance add or rename takes over the households' entries of its fold in one transaction (every household row, then their recipes, then the entries; `lists.changed` to each); a household add or rename holds its household first, so it never shadows one. The boot fold merges a household entry folding like an instance entry into it ("Breakfast!", "Bréakfast"); 0092 unchanged.
- Fixed (ea2eb174c): another household's Cuisine id with no entry of its fold is refused (NOT_FOUND), no longer dropped.

Re-review of the server round:

1. Fixed (18d08aa76, e337703d9): one transaction advisory lock per kind and fold (`lockEntryFoldsTx`), taken by every write giving an entry a fold, after household rows and before list rows; an instance takeover locks only the households holding the fold (until settled), list rows by id, retries `40P01` and `23505` three times; a leave or join maps a fold the instance holds onto its entry. Each household that lost a twin hears `lists.changed` once on its own channel.
2. Verified (aad58e96f): after a takeover, a save leaving the Cuisines alone keeps the re-pointed link; one sending the old id answers stale. Tags and Categories save by name, covered by the stale-name tests.
9. Fixed (ccbc6fe29): the entry comments run two lines.
