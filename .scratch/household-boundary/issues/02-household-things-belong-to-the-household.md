# 02: Household things belong to the household

**What to build:** Stores (with their aisles, Store Products and Product Links), groceries, recurring groceries, Pantry Ingredients, meal plan items, nutrition corrections and store preferences belong to the household. A member who leaves takes none of them, and deleting an account deletes none of them. See the spec, "What belongs to whom".

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] **Columns:**
  - `stores`, `groceries`, `recurring_groceries`, `pantry_ingredients`, `planned_items`, `ingredient_nutrition_corrections` and `ingredient_store_preferences` get `household_id` (not null), filled from the household of the member who added each row.
  - Their `user_id` becomes "added by": nullable, `ON DELETE SET NULL`.
- [ ] **Uniqueness moves to the household:** the Pantry's one-per-household rule and the corrections' unique key become database constraints on `household_id`.
- [ ] **Queries** filter on `household_id` instead of member ids. `assertHouseholdAccess` (`packages/auth/src/permissions.ts`) compares household ids.
- [ ] **"Added by" for a deleted member** reads "a former member" wherever Norish shows who added a row (web and mobile), in all locales.
- [ ] **Tests:** a member leaves and the household keeps their stores, groceries, pantry, plan entries and corrections. Their new household starts with none of them. E2E with two members.
