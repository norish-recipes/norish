# 05: Tags, Cuisines and Categories are household lists

**What to build:** Each household has its own Tags, Cuisines and Categories, unique on the folded name, plus the instance entries: the four built-in Categories and the administrator's Cuisines. A recipe carries only its household's entries and the instance's. Entries stay until deleted, households may add Cuisines, and allergies become plain names. See the spec, "Tags, Cuisines and Categories", and ADR-0043.

**Blocked by:** 03

**Status:** ready-for-agent

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
- Still on member ids: `ctx.userIds` only for `actorOf` (the catalogue actor, ticket 07); `householdMemberIdsSql` for household favourite/rating counts in random picks and `getHouseholdMemberIdsByUserId` for CalDAV dedup (account rows); the roster cache for the WS context, export and media session. `getHouseholdMemberIdsByHouseholdId` is gone.
- Deviation: Search suggestions and Discover group every household's entries of one fold into one name (the reader's spelling first); they narrow to visible recipes, as before. Repository layer: nothing outside `packages/db` read or wrote these tables; db tests now seed through `attachTestEntry`. Not done: the E2E spec typechecks and lints but was not run.

