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

- For ticket 09: `recipes.household_id` and `cookbooks.household_id` cascade from the household row, so anything that deletes a household must move its recipes and cookbooks first.
- Review round 1:
  1. fixed: gallery, video, thumbnail and step-image rows name only the recipe's own folder (remote URLs pass), checked in the repository; every file deletion names its recipe; a not-yet-stored id is claimed in Valkey by its first uploader, and a create with another's id is refused.
  2. fixed: the null case was the new-recipe form's uploads; a file whose row is missing is served only to the account holding the claim, and a cookbook file never.
  3. fixed: a share link is inactive while its maker may not view the recipe and works again after; the inventory leaves such shares out; share procedures already need edit, so view.
  4. fixed: a taken recipe id is a `TakenIdError`, answered NOT_FOUND "Not found" like a key collision.
  5. fixed: the trigger locks household, then membership; an update keeping its Owner keeps the household, the move's nested update is taken as it is; eight race tests, seven fail on the old triggers (a leave queued before an update cannot deadlock).
  6. fixed: recorded above for ticket 09.
  7. fixed: `policyAudience`/`recipeAudience`/`cookbookAudience`/`accountAudience` read the row's household and the policy at publish; imports, archive batches, pending and import status read the account's household now.
  8. fixed: confirmed; a policy-scoped cursor carries the view level, so one minted under another is refused identity-changed and the client refetches.
  9. fixed: `readerScopedKeys` (recipes, cookbooks, Library, favourites, ratings, plan, groceries, Tags, policy) reread on a policy change and a member joining or leaving; a move of the Reader rereads everything.
  10. fixed: the API lists a planned recipe out of view by title.
  11. fixed: grocery reads and RETURNING mask a recipe line out of view; an edit keeps its stored line unchecked; a toggle writes only `isDone`.
  12. fixed: confirmed; the worker links a recipe only while the account may view it when the job runs.
  13. fixed: `isRecipeOutOfView` in `shared-react/calendar`, used by the web panel and mobile sheet; the draft keeps "a recipe entry has no text", which is not that predicate.
  14. fixed: `policyReach` is the rule; `policyAllows`, the SQL condition and the dedup id use it; `findRecipeIdByUrlForAccount`; Tags by the view condition; `resourceAccess` + `refuseUnlessAllowed` for recipes and cookbooks.
  15. fixed: `canViewRecipe`.
  16. fixed: `getRecipeHouseholdId`, the three selectors (now `selectAllows`) and `{ query }` gone; `PolicyTarget` used; `CookbookUserContext.user` gone. `ratingAudience` now reads at publish (7), so it stays.
  17. fixed: `householdIdFilledByTrigger` in `schema/shared.ts`.
  18. fixed: comment gone; `useReaderOwner` gives no optimistic row until the Owner is known.
  19. fixed: `useHouseholdRights`/`HouseholdRow`; favourites take `ctx`.
  20. fixed: the harness finds recipes through `recipes.list` as the signed-in reader; export deleted.
  21. fixed: all five trimmed.
  22. fixed: in the touched functions of the share cache, both web cards and the actions menu; `use-recipe-shares-query.ts` only lost a function, so its hooks stay.
  23. fixed: the mocks answer only for the row under test.
  - asked of the maintainer: admin job monitor payloads, admin bulk AI enrichment, admin share-link moderation; moved: ingredient usage counts to ticket 07, file sweep and plan notes to ticket 04; rejected: in-flight requests keep their authorisation, the seeded-Ingredient admin path.
- Review round 2:
  1. fixed: only the upload writing an id's first file claims it; files whose claim is gone are no one's (no serve, upload, delete or create).
  2. fixed: `mediaId` takes only the lowercase spelling; recipe, step, video and cookbook routes and procedures refuse any other as not found.
  3. fixed: a View Epoch in Valkey, bumped after a policy change and with every membership announcement, is in every cursor's identity; one server-wide epoch.
  4. fixed: the offline QueryClient drops a read's data, in memory and stored, when it answers NOT_FOUND; a network failure keeps it.
  5. fixed: the trigger locks once, household then membership, and raises 40001 when the membership moved; `authedProcedure` answers it CONFLICT. Owner-household races 20/20.
  6. fixed: cookbook events take `cookbookAudience` at publish (a delete: the household its RETURNING names); enrichment's update takes `recipeAudience`.
- Review round 3:
  1. fixed: an upload validates its file before it claims a not-yet-stored id, and a failed write gives the claim back when no file landed (images, step images, videos).
  2. fixed: `FullRecipeInsertSchema` lower-cases a client-made id; the media routes still refuse any other spelling.
  3. fixed: the View Epoch is a random token (`valkey/token.ts`, shared with the household cache): a change sets a fresh one, a reader that finds none creates one.
  4. fixed: a NOT_FOUND read keeps its data while a create for that id is in flight or in the Outbox; with nothing pending it still drops.
  5. fixed: the owner-household trigger raises its own SQLSTATE `NH001` (0090 edited in place); only that maps to the retry. Owner-household races 10/10.
  6. fixed: that refusal answers 503 SERVICE_UNAVAILABLE, which Replay retries; other conflicts stay 409 and park.
  7. fixed: confirmed; a paste import cleans up only on its final failure, and the paste, URL and image workers remove only the media of recipes they never stored. The archive import has no such clean-up.
  - rejected: row ids in any letter case; an expired draft claim; device image caches; the read-to-publish instant; announcements after a failed epoch bump; moved to ticket 04: the resume epoch on account deletion.
