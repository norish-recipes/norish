# 03: One Permission Policy over recipes and cookbooks

**What to build:** Recipes and cookbooks carry their Owner's household. A single instance-wide policy says who outside a household may view, edit and delete them, each set to Everyone or Household. A server admin is an ordinary member under it, and existing orphans go to the server owner's household. See the spec, "The Permission Policy", and ADR-0041.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] **Columns:** `recipes` and `cookbooks` get `household_id` (not null), filled from their owner's household.
  - Orphans (`user_id` null) go to the server owner, in the server owner's household.
  - `user_id` becomes not null.
- [ ] **The policy schema** (`packages/config/src/zod/server-config.ts`): levels `everyone | household`, with edit and delete never wider than view.
  - The server refuses a wider level.
  - Migration turns a stored `owner` into `household` and drops the `ingredient_permission_policy` row and its schema.
  - The default is unchanged.
- [ ] **No admin bypass, and no orphan branch:**
  - `canAccessResource`, `buildOwnerPolicyCondition` (`packages/db/src/repositories/recipes.ts`), `assertRecipeAccess` / `recipeAccess` / `findRecipeForViewer`, `assertCookbookAccess`, the media session check and `config.tags` lose their `isServerAdmin` branch and their null-owner branch.
  - The Household level means `household_id` equals the reader's.
- [ ] **The admin recipe export** (`?scope=instance` in `apps/web/app/(app)/export/recipes/route.ts`, ADR-0022) goes. An admin exports what they can view, like everyone else.
- [ ] **Client selectors** (`packages/shared-react/src/reader/permission-selectors.ts`) mirror the server, and drop the `owner` fallback.
- [ ] **The admin card** (`apps/web/features/admin/components/permissions/permission-policy-card.tsx`) offers Everyone and Household, and disables edit and delete levels wider than view. The ingredient policy select goes.
- [ ] **Out-of-view references:** a meal plan entry for a recipe the household can't see shows only the recipe's title, on web and mobile. Cookbook members and favourites already follow the view condition.
- [ ] **Realtime:** `policy`-scoped events route by the recipe's household id.
- [ ] **Tests:**
  - the router policy matrix (view, edit and delete × both levels), including that an admin is refused outside their household;
  - a migration test covering orphans, `owner` → `household` and the dropped ingredient policy;
  - E2E with two households under view Household: neither sees the other's Library, and that includes the admin.
