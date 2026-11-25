# 02: Household things belong to the household

**What to build:** Stores (with their aisles, Store Products and Product Links), groceries, recurring groceries, Pantry Ingredients, meal plan items, nutrition corrections and store preferences belong to the household. A member who leaves takes none of them, and deleting an account deletes none of them. See the spec, "What belongs to whom".

**Blocked by:** 01

**Status:** ready-for-agent

- [x] **Columns:**
  - `stores`, `groceries`, `recurring_groceries`, `pantry_ingredients`, `planned_items`, `ingredient_nutrition_corrections` and `ingredient_store_preferences` get `household_id` (not null), filled from the household of the member who added each row.
  - Their `user_id` becomes "added by": nullable, `ON DELETE SET NULL`.
- [x] **Uniqueness moves to the household:** the Pantry's one-per-household rule and the corrections' unique key become database constraints on `household_id`.
- [x] **Queries** filter on `household_id` instead of member ids. `assertHouseholdAccess` (`packages/auth/src/permissions.ts`) compares household ids.
- [x] **"Added by" for a deleted member** reads "a former member" wherever Norish shows who added a row (web and mobile), in all locales.
- [x] **Tests:** a member leaves and the household keeps their stores, groceries, pantry, plan entries and corrections. Their new household starts with none of them. E2E with two members.

## Comments

- Migration 0089 (rerunnable): each row takes its adder's current household; a store preference takes its store's household. A grocery pointing at another household's store or recurring grocery is unhooked (set null). Duplicates under the new keys: the Pantry keeps the oldest row of a food (same food, nothing lost); corrections and store preferences keep the most recently updated, the one reads already chose. Store products, links and aisles follow their store, unchanged.
- Store preferences are now one per household and Ingredient (`uq_ingredient_store_prefs_household_ingredient`), not per member: a per-member key would have blocked a leaver's new household. Merges re-point Pantry rows, corrections and preferences per household; the planner locks the household row instead of the user row.
- Also fixed: store reorder, recurring update/detach/check wrote rows of any household by id; the recurring check published to the adder's current household; CalDAV synced a leaver's old plan. CalDAV still syncs the entries a member added, now only in their current household.
- No screen shows who added a household row (web or mobile), so "a former member" copy had nowhere to go; `user_id` is null after deletion and no UI reads it.
- Still on member ids (owner-keyed until 03/05/07): `ctx.userIds` for tags, categories, allergies, the permissions router and the catalogue actor; `listPantrySuggestions` reads the members' recipes; the roster cache serves the WS context, export and media session. HTTP requests read the household fresh per request.
- Outside `packages/db` nothing queries the seven tables; the shared-server and api tests that seeded them with drizzle now go through repository-backed helpers. `packages/db`'s own tests still seed directly. The E2E spec typechecks and lints but was not run.

- Review round 1:
  1. fixed: every by-id op on the seven tables takes the acting household through `householdRow`/`householdRows` (`repositories/household-rows.ts`); routers keep their refusals; a real-Postgres boundary test.
  2. fixed: `assertOwnReferences` refuses a Store or recurring grocery of another household on every grocery, recurring and preference write; Store and recurring deletion and the scheduler select groceries by household too.
  3. fixed: `storeExistsForHousehold`/`assertStoreAccess`, `groceriesOfHousehold`, `assertRecurringAccess`, and `plannedItemOfHousehold` for the plan.
  4. fixed: the CalDAV worker reads `findPlannedItemPlace` when it runs; an entry left behind is deleted from the calendar instead.
  5. fixed: the status list joins only plan entries of the account's current household.
  6. fixed: leave and remove queue the existing delete job for each left-behind status after the move commits; the worker drops the status, or the status alone goes when CalDAV is off.
  7. fixed: `listPlannedItemsAddedBy(householdId, userId, from)`; retry reads the entry scoped to the household; real-repository test with two households.
  8. fixed: an invalidation leaves a 30 s marker a fill cannot overwrite (`SET NX`); deterministic Valkey test.
  9. fixed: cache drop, the mover's own events, their Scope Change, then the members who stay; the mover's `created`/`userKicked` still arrive before the close, and the reconnect refetches.
  10. fixed: boot conversions resolve a row as its adder or its household's admin, key parked links by their own household's groceries, restore a gone account's preference added by no one, and log a link dropped with its Store; real-Postgres tests.
  11. fixed: Fill gaps ignores household corrections; `findAnyCorrections` is gone.
  12. fixed: store lookup and refresh jobs carry no household and read the Store's at run time.
  13. fixed: the last-member deletion asserts all seven tables.
  14. fixed: aisles, aisle links, products and product links in the fixture, checked after both runs.
  15. fixed: both headers, plus three other headers over two lines.
  16. fixed: `findGroceryFoods(ids, householdId)` groceries only; `listPantrySpellings` gone, helpers read the test db; unused `getGroceryById`, `toggleGrocery`, `deleteGroceryById`, `updateGrocery`, `getRecurringGroceriesByIds`, `updateRecurringGroceries` deleted.
  17. fixed: `lockHousehold`; the router helpers replaced the `ownerId` locals.
  18. fixed: `rememberStorePreference(householdId, userId, …)`.
  - rejected: preference takes its store's household; one preference per household and food; userId stays on DTOs; catalogue maintenance and ingredient tests go to ticket 07.

- Review round 2:
  1. fixed: a per-account generation replaces the marker; entries carry the generation read before the database, checked in one `MGET`; tests for a stalled fill, two fills and an invalidation with no entry.
  2. fixed: the worker reads the entry's place again after the write and takes off an event written while its adder left, keeping no status.
  3. fixed: leave and kick clear the calendar in a `finally` after the announcements.
  4. fixed: a failed event removal throws, so the job's retries and the failed status keep it retryable.
  5. fixed: the status list, its count and the summary leave out statuses of entries in another household (an entry deleted since still shows, so "removed" keeps its history).
  6. fixed: `getCaldavSyncStatusById` and `getFailedSyncStatuses` deleted.
  7. fixed: a parked aisle or product link whose aisle or product is gone is skipped and counted in a log; the other boot conversions cannot meet a gone household or actor (household columns are NOT NULL, the admin is NOT NULL, a gone Store or account was already handled); real-Postgres test.
  8. not changed: verified. Every one of the seven tables has a NOT NULL `household_id` since 0089, which ran while `user_id` was still NOT NULL; the admin is only the actor.
  9. fixed: `assertPantryIngredientAccess`.
  10. fixed: nothing read there reached the client or changed state; `getAisleById` now takes the Store and `getStoreProductById` the household in their WHERE, so updating another household's product answers NOT_FOUND.
  11. not changed: `resolveIngredientNutrition` is unchanged since 9df97cf30; a food's own facts already came before a parent's.
  12. fixed: `listStaleProducts` takes the Store ids in its WHERE; a Store deleted mid-visit ends refresh and lookup jobs with a debug log (lookup had the same defect).
  13. fixed: `findNewestGroceryNamed(householdId, name)`; the E2E helpers pass the household.
  14. fixed: the router keeps its announcement chains and the test awaits `announcementsSettled()`.
  - moved to ticket 03: view check on recipeId / recipeIngredientId references and their joined recipe metadata; rejected: socket window between commit and Scope Change; reorder and markAllDone rely on scoped SQL; gap fill ignores household corrections.
