# 04: Deleting an account erases what it owns

**What to build:** Deleting an account erases the recipes and cookbooks it owns and everything that belongs to the account, its share links included. The household keeps its own things, and meal plan entries for the erased recipes become notes with the recipe's title. A household whose last member is deleted goes with everything in it. See the spec, "Membership changes".

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [x] **Recipes and cookbooks** `user_id` become `ON DELETE CASCADE`, so the images, videos, step images and cookbook files of erased recipes are swept as recipe deletion already does.
- [x] **Account rows** (ratings, favourites, allergies, API keys, CalDAV, Site Accounts, share links) keep cascading.
- [x] **Plan entries for erased recipes:** before the cascade, `deleteUserAccount` (`packages/auth/src/account-deletion.ts`) turns the household's plan entries for the account's recipes into notes carrying the recipe's title.
- [x] **Last member deleted:** the household row and everything with its `household_id` are erased. A member of a larger household is handed on as admin first, as today.
- [x] **Both paths** use the same function: a person deleting their own account, and an admin removing someone.
- [x] **Tests:**
  - the household keeps its stores and groceries, and the plan shows the note;
  - the deleted account's recipes are gone for every reader;
  - deleting the last member erases the household.
  - E2E for self-deletion.

## Comments

- Erased: the account's recipes (lines, steps, images, videos, shares, and every favourite, rating and cookbook entry of them, anyone's) and cookbooks; its ratings, favourites, allergies, preferences, language, API keys, sign-in rows, CalDAV config and statuses, Site Accounts, the shares it made, Valkey sessions. Kept, "added by" null: stores, groceries, recurring, Pantry, plan, corrections, store preferences. Changed: plan entries for its recipes in any household become notes; grocery lines from its recipes keep their text, unlinked. A last member's household goes whole (only other households' entries become notes). Recent Searches are device-local and go with the app's sign-out wipe. `account-deletion.test.ts` checks it per table.
- A note keeps date, slot, sort order, household and adder; it takes the recipe's title, `recipe_id` null, version +1 (servings live on the recipe, so none). It is converted inside `deleteAccount`'s transaction after the account's recipe rows are locked `FOR UPDATE`, so a plan written meanwhile either becomes a note or is refused (23503).
- After the commit `deleteUserAccount` ends the sessions, then `announceMembershipChange` (cache for everyone affected, View Epoch, Scope Change, then `memberRemoved`, `adminTransferred`, recipes and cookbooks `deleted`, and `itemUpdated` per note); the Scope Change and the sweep run even when an earlier step throws. `itemUpdated` makes the CalDAV listener resync a synced entry: same event, recipe's title, no link.
- Files are swept last, by id: `recipes/<id>/` (images, step images, videos, thumbnails; ticket 03's rule keeps every row inside its own folder), `cookbooks/<id>/`, the avatar. A failed sweep is logged and the nightly orphan cleanup stays the backstop; the deletion stands.
- Workers: URL, paste and image imports fail for good (no retry, unstored media swept, nothing published) when the account is gone at the start or their save fails because it went; enrichment ends quietly for a gone recipe (and sweeps a file written after the sweep); Enrich All of a gone admin enrolls nothing; a CalDAV failure of a gone account records nothing. Store lookups already end on a gone Store; CalDAV jobs already took a gone account's entry off.
- Deviation: self-deletion no longer refuses a household admin with members; it hands the role on as an admin's removal does (copy updated in all locales). The E2E teardown (`closeAndDelete`) still calls the repository `deleteAccount` directly: the same erasure, without sessions, announcements or the file sweep, since loading Better Auth in the Playwright process is out of reach.
- Repository layer: nothing touched reads or writes outside `packages/db/src/repositories`. Races (20/20 each): join behind a last member's deletion, admin deletion vs a member's leave (both orders), two deletions in one household (both orders), a plan entry for the account's recipe before and behind the deletion; the own-recipe-write races are ticket 03's. Not done: the E2E spec typechecks and lints but was not run.
