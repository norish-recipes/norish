# 03: One Permission Policy over recipes and cookbooks

**What to build:** Recipes and cookbooks carry their Owner's household. A single instance-wide policy says who outside a household may view, edit and delete them, each set to Everyone or Household. A server admin is an ordinary member under it, and existing orphans go to the server owner's household. See the spec, "The Permission Policy", and ADR-0041.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] **Columns:** `recipes` and `cookbooks` get `household_id` (not null), filled from their owner's household.
  - Orphans (`user_id` null) go to the server owner, in the server owner's household.
  - `user_id` becomes not null.
- [x] **The policy schema** (`packages/config/src/zod/server-config.ts`): levels `everyone | household`, with edit and delete never wider than view.
  - The server refuses a wider level.
  - Migration turns a stored `owner` into `household` and drops the `ingredient_permission_policy` row and its schema.
  - The default is unchanged.
- [x] **No admin bypass, and no orphan branch:**
  - `canAccessResource`, `buildOwnerPolicyCondition` (`packages/db/src/repositories/recipes.ts`), `assertRecipeAccess` / `recipeAccess` / `findRecipeForViewer`, `assertCookbookAccess`, the media session check and `config.tags` lose their `isServerAdmin` branch and their null-owner branch.
  - The Household level means `household_id` equals the reader's.
- [x] **The admin recipe export** (`?scope=instance` in `apps/web/app/(app)/export/recipes/route.ts`, ADR-0022) goes. An admin exports what they can view, like everyone else.
- [x] **Client selectors** (`packages/shared-react/src/reader/permission-selectors.ts`) mirror the server, and drop the `owner` fallback.
- [x] **The admin card** (`apps/web/features/admin/components/permissions/permission-policy-card.tsx`) offers Everyone and Household, and disables edit and delete levels wider than view. The ingredient policy select goes.
- [x] **Out-of-view references:** a meal plan entry for a recipe the household can't see shows only the recipe's title, on web and mobile. Cookbook members and favourites already follow the view condition.
- [x] **Realtime:** `policy`-scoped events route by the recipe's household id.
- [x] **Tests:**
  - the router policy matrix (view, edit and delete × both levels), including that an admin is refused outside their household;
  - a migration test covering orphans, `owner` → `household` and the dropped ingredient policy;
  - E2E with two households under view Household: neither sees the other's Library, and that includes the admin.

## Comments

- Migration 0090 (rerunnable): Orphans go to the server owner, else the longest-standing admin, else the longest-standing account; on a server with no account at all they are deleted (nothing could own them). An orphan whose URL its heir already has (or an older orphan brings) keeps everything but the URL (`uq_recipes_url_user`). Cookbook memberships, another owner's recipes included, are untouched. 0091 turns `owner` into `household`, fills missing levels, clamps edit/delete to view and drops the Ingredient policy row; SQL, so it runs before any read.
- The invariant is kept in the database: a trigger sets `household_id` from the Owner's membership on every write (waiting out a move with `FOR SHARE`), and a `household_users` trigger moves the Owner's recipes and cookbooks inside every membership transaction; `owner-household.test.ts` checks every operation and both race orders.
- Deviation: `user_id NOT NULL` forced `ON DELETE CASCADE` now, so deleting an account erases its recipes and cookbooks; ticket 04 still owes the file sweep (the nightly orphan-media cleanup covers it meanwhile) and plan entries becoming notes (they cascade until then).
- Out of view: a plan entry sends `recipeId`, picture and numbers as null and keeps the title (web panel, mobile sheet, CalDAV without a link); a grocery line from such a recipe lists with the hand-added lines. Writing a plan entry, a grocery line, a favourite or a rating needs view at that moment; a hidden recipe answers NOT_FOUND like a gone one, bulk delete included.
- Also changed: the admin share-link moderation card and its procedure went (no bypass in share management); `recipeExistsByUrlForPolicy` always said "exists" (`undefined !== null`), fixed; the Ingredient edit rule is now "your household's rows, seeded ones for admins" until 07.
- Still on member ids: Tags, Categories, allergies (05), the catalogue actor (07), the archive's Category match (05), and household favourite/rating counts in random picks (account rows). The roster cache stays for the household id in the WS context, export and media session. Shared-server catalogue tests still read recipe lines through the test drizzle client (07).
- `isServerAdmin` remains for instance rights only: admin procedures and the admin area, account roles, the AI-key prompt, and seeded catalogue rows.
- Not done: the E2E specs typecheck and lint but were not run.

