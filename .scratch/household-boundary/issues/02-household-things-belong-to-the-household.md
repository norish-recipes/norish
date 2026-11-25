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

