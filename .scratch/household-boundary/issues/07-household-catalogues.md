# 07: Each household has its own catalogue on the shared seed

**What to build:** A household's catalogue is the seed plus its own foods, spellings and junk marks. Resolution, merges and AI never cross households. Any member edits the household's foods, and the seed is the admins' alone. The export covers the seed plus your household's foods, and a food added by hand is never swept. See the spec, "Ingredient catalogue", and ADR-0042.

**Blocked by:** 02

**Status:** done

- [x] **Columns:** `ingredients`, `ingredient_aliases` and `ingredient_junk_pile` get `household_id` (null means the seed).
  - A spelling's fold and an Ingredient's name are unique within a household and among the seed.
  - Where a household's spelling and the seed's are the same, the household's wins for that household.
  - The seed refresh (`packages/db/src/repositories/ingredient-seed.ts`) finds an entry by id, else by the seeded Ingredient holding its name, and never adopts or changes a household's food.
  - `ownerId` stays as "added by".
- [x] **Migration** splits every non-seed Ingredient used by more than one household into a copy per household. The minting household keeps the original id. A copy carries:
  - the spellings that household's rows use;
  - the icon;
  - a parent in the same household or the seed;
  - the AI Changes on it.

  Aisle Links, Product Links and store preferences follow the copy belonging to their store's household. Ownerless non-seed foods go to the server owner's household (spec, "Upgrade").

- [x] **The resolver** (`packages/shared-server/src/ingredients/resolver.ts`) reads only the household's spellings and the seed's, and mints into the household that triggered it.
- [x] **Rights** (`mayEditOwnedRow` and its callers in `packages/shared-server/src/ingredients/catalogue.ts`):
  - any member of the household may act;
  - the seed is admin-only;
  - a merge needs edit on both foods;
  - an alias added to a seed food is the household's;
  - the ingredient policy is gone.
- [x] **AI per household:** the automatic review, Catalogue Cleanup and Fill Gaps (`packages/trpc/src/routers/admin/ingredient-catalogue.ts`, queue workers) run per household plus the seed. An admin-started run loops over households. AI Changes and flags are listed to the owning household.
- [x] **Export** (`apps/web/app/(app)/export/ingredients/route.ts`): the seed plus the reader's household's foods.
- [x] **Adding by hand:** an `ingredients.add` procedure (a name plus optional spellings) marks the food as added by hand. The unused sweep and AI never delete it. Minted foods keep the 90-day rule.
- [x] **Realtime:** catalogue events go on the household channel.
- [x] **Tests:**
  - resolution never crosses households: B's "kipfilet XL" mints B's own food even though A has one;
  - a household spelling on a seed food changes only that household's resolution;
  - a cross-household merge is refused;
  - a migration test for the split;
  - E2E with two households on the Ingredients page.

## Comments

- Migration 0093 (SQL, rerunnable): a seeded food (`off_id`) and the seed's own spellings and junk stay `household_id` null; an own food goes to its minter's household, else the heir of ticket 03 (server owner, longest-standing admin, account), and with no account at all it is deleted; a person's spelling on a seeded food goes to its adder's household (else the heir's). A seeded food under an own parent loses that parent. Every household naming an own food (recipe lines through the recipe's household; groceries, recurring, Pantry, corrections, store preferences; Aisle and Product Links through their Store's household; a child's own parents, recursively) other than its home gets a copy: no "added by", same flags and icon file, the spellings its rows use (else the oldest), its parent as that household's copy or the seed's, AI estimates, and the merge/parent/plain-name AI Changes remapped to its spellings and parents; a spelling change stays with the spelling's household. Every row of that household is re-pointed; a person's spelling on a seeded food is copied per household using it. Junk: the seed's stays, every other mark is held for each household. Names and folds were unique server-wide, so the split makes no duplicates; a household food named like a seeded one is tested in the seed refresh instead.
- Uniqueness: partial unique indexes on (household, lower(name)) / (household, fold) where household set, and on lower(name) / fold among the seed; CHECK `(household_id is null) = (off_id is not null)`. Reads are `inCatalogue` (`catalogue-scope.ts`), the household's row of a fold first; an automatic spelling (rename, plain name, cleanup rewrite) is never written over a fold the catalogue knows, so only a person's add shadows the seed. A household lifts a seed junk mark for itself with a `names-a-food` row.
- Resolver: `ResolveActor.householdId` required, per-household junk in the rules cache; recipe saves read the recipe's household when they resolve (`lineHousehold`), groceries/recurring/Pantry/store lookups the request's, boot conversions and re-resolution each row's. A mint whose name the household or the seed has joins that food (a seeded one only gains the spelling). Seed refresh finds by `off_id`, else the seeded food holding the name, never adopts (`adopted` gone).
- Rights: the household's rows any member, the seed's admins; a by-id read outside the catalogue answers not found. Merge: same household, or a household's food into a seeded one by an admin of that household; seeded into a household's is forbidden. A seeded spelling moves only to a seeded food; a seeded food is filed only under a seeded one.
- AI: every change runs in the asked food's household plus the seed (`lockForAI` refuses others) and records `household_id`; listed to that household, null rows to admins (none are made). Clean up, Fill gaps and the sweep loop households; a seeded food's added spellings are checked per household.
- `ingredients.add({ name, spellings?, locale? })` answers `{ ingredient: IngredientListItem | null, created }`; an existing household or seeded food of the name answers `created: false` unchanged; rename's name rules; `added_by_hand` keeps it listed, unswept and out of AI.
- Realtime: `ingredients.changed` is policy-scoped: the household channel, everyone for an admin's seed edit. `ctx.userIds` and `memberIds` are gone; the roster cache stays for the WS context, export and media session; `householdMemberIdsSql` (random picks) and `getHouseholdMemberIdsByUserId` (CalDAV dedup) read account rows.
- Ticket 08: `icons`, `names`, `nutrition(For)` and library suggestions answer only the reader's catalogue, so another household's recipe shows no icons or nutrition for its own foods until its lines are read through the reader's catalogue. Ticket 09 must re-home a leaver's lines, which still point at the old household's foods and spellings (no constraint blocks it; deleting that household's last member then drops those line foods), and merge catalogues on join; `HELD_BY_HOUSEHOLD` now counts foods, spellings and junk.
- Not moved: first-start-cleanup, review, spelling-check, resolver, plain-names, resolver-ai, parent-from-words, ingredient-nutrition and the api upgrade tests still read the test db directly (only the listed files moved). The E2E spec typechecks and lints but was not run.


- Review round 1:
  1. fixed: 0093 copies every change on a split food and remaps `target_id` and every undo id to the change's household (its row, its copy, the seed's, or one gone); a change naming another household's row with no copy there drops those ids, is marked `stranded` and keeps no Undo; Undo refuses anything outside the actor's catalogue (`undoStaysIn`); the list names only foods of the change's catalogue.
  2. fixed: the first load takes every own food not added by hand whose spelling (or stripped spelling) the seed gives one entry, and flags one it gives several; a food added by hand is also left alone by the mints recheck, seed corrections and earlier-variant filing.
  3. fixed (verified): an entry found by name adds its spellings to that food, and its parent and codes unless another entry is that food by id; that food is no longer removed as dropped.
  4. fixed: the second run compares recurring groceries and whole AI Change rows; heir cases for an owner, an admin, ordinary accounts only, and no account.
  5. fixed: a merge into a seeded food writes nothing on its row; AI's flag writes touch household foods only. Checked: Keep's distinct mark never reaches a seeded food; icons and estimates on seeded foods come only from an admin's Fill gaps; seed junk and seeded parents only from an admin's edit.
  6. fixed (verified): the lookup reads the food the Store's grocery of that name names when it runs.
  7. fixed (verified): the mint holds the joined food (and its parent) `for key share`; it takes no tree lock, so no cycle.
  8. fixed: households with foods or spellings.
  9. fixed: `exists`/`notExists`/`inArray` subqueries, one array parameter per list (`array-params.ts`), `VALUES` batches as arrays, the nutrition tuple per dataset. Left: recursive CTEs, the search's lateral name and the kinds count (no builder method), expressions and operators.
  10. fixed: the nine files read through helpers; no other test in those packages queries the database. `db-test-helpers`: two column comparisons in `sql` (now `eq`) and an unused raw `SELECT 1` (deleted).
  11. fixed: `household-scope.ts` (`inScope`, `inCatalogue`, `isInstanceRow`) for lists and catalogue.
  12. fixed: `forEachCatalogue`; `groupBy` in `shared/lib`, mealie's copy too.
  13. fixed: `editableHouseholds` is the one rule; `seeded ||` gone.
  14. fixed: comments reworded; `withTableName`, `containsText`, `searchedName.lateral`; `Scope` unexported.
  - For ticket 08: add-to-groceries must not keep a line's food from another household (`keptFoods`); display of a foreign recipe's own foods and icons; REST nutrition.
  - For ticket 09: re-point a leaver's recipe lines when they leave, so deleting the old household's last member drops no line food, and Pantry suggestions name no old household's food.
  - rejected: the names-a-food mark, uses without elsewhere, a household's spelling change listed to that household, an admin's own-to-seed merge, the membership read before a recipe write, the junk rules cache, qualified(), the diacritics constant.

- Review round 2:
  1. fixed: Keep or Undo of a change whose food is now seeded needs an admin unless it is a merge or a spelling change (which write nothing on the seeded row); `editableBy` is never NULL, so a member's Undo moving a seeded spelling is refused.
  2. fixed: the mint answers whether it created a food; only a created one is handed to the review, icon and fills.
  3. fixed: 0093 remaps or strands on every nested id of a not-a-food payload and strands an unknown kind; a stranded change is never actionable (`canAct` false, Keep and Undo refused).
  4. fixed (verified): `markDistinct` was guarded; Keep's non-merge branch marked a seeded food distinct, and now leaves it unmarked.
  5. fixed: the match job carries its grocery's id and files under the food that grocery names when it runs.
  6. fixed (verified): the mint reads its holder and parent, then locks both in id order; a name taken meanwhile starts the mint again.
  7. fixed: `count()` with numeric decoding; the standalone check selects the kind's id.
  8. fixed: `spelling-check` counts exactly again (the other eight files' assertions were equivalent); the rerun compares whole rows of every table 0093 writes.
  - rejected: the recheck folding a minted duplicate into a hand-added food; a migration rerun rewriting AI Changes.

Final review, server round:

- Fixed (65bd2a2b2): a spelling an admin adds to a seeded food is announced to their household; a draft touching the seeded food itself still reaches everyone.
- Verified and fixed (697985a55): Undo restored `undo.spelling.ownerId`; 0093 now nulls the adder on every copied change (merge, spelling, not-a-food and its spellings).
- Fixed (f7e7393e5, aaf808c67): the search lateral is a builder subquery, array casts are fixed fragments, the test join is `and(eq, eq)` in one helper, the pid query is `backendPid`, shared-server tests use `inRepositoryTransaction`. Left: `select ingredient_id from covered/kinds`, as drizzle 0.45.4's `buildWithCTE` never writes `recursive`.
- Fixed (2847281cd): `ingredients.countUses` (builder counts) feeds "Used by" and the delete confirmation; `ingredients.recipes` pages by 50 (`useFoodRecipes`); `ingredients.uses` keeps groceries and Pantry.
