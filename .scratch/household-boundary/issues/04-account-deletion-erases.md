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
- Review round 1:
  1. Fixed: one queue-layer purge (`remove-account-jobs.ts`) removes the account's waiting, delayed, completed and failed jobs (and its erased recipes') after the commit; a job running then fails as `AccountGoneError` and is removed once it settles.
  2. Fixed: the deletion sweeps the account's pending upload folders and their Valkey claims.
  3. Fixed: the account guard fails an in-flight CalDAV job for good (no retry); a sync or failure writes the status's `itemType`, so a note is recorded as one.
  4. Fixed: a note with its own title keeps it and only loses the link.
  5. Fixed: past the commit `deleteUserAccount` succeeds, each step and announcement runs on its own and logs its failure; a deleted account's sockets close with 4410 and its other devices clear the Outbox too (an offline device only sees an ordinary expiry).
  6. Fixed: locked membership writes retry a deadlock (3 tries, backoff); `40P01` answers 503. Races 20/20.
  7. Fixed: the image import, gallery image and gallery video uploads remove a saved file whose row fails; URL and paste imports already sweep unstored media on failure, generated images already remove theirs.
  8. Fixed: the nightly media cleanup prunes cookbook folders of no cookbook and files no cover names.
  9. Fixed: per-table checks (household tables, recipe media, sessions, CalDAV statuses) in all four cases, plus the last member's recipe planned abroad.
  10. Fixed: the E2E runs under view Everyone and Household (typechecks and lints, not run).
  11. Fixed: one guard in `createWorker` (`account-jobs.ts`) for every account queue; `accountGone` and `failForGoodIfAccountGone` are gone.
  12. Not changed: leave publishes `userLeft` to each member and kick publishes `memberRemoved` alone, so neither repeats deletion's `memberRemoved` then `adminTransferred` sequence.
  13. Fixed: the `deleteUserAccount` and `deleteAccount` comments are two lines (`AccountDeletion.notes` already was one).
  14. Not changed: auth's typecheck needs it (`storage.ts` imports `heic-convert`, TS7016 without it).
  - Rejected: catalogue owner set null on deletion (ticket 07 gives foods a household); the remote CalDAV calendar stays; admin self-deletion hands the role on; the E2E teardown.
- Review round 2:
  1. Fixed: after a failed row insert, gallery image, gallery video and image-import uploads remove the file only when no image or video row names it (`deleteUnreferencedRecipeFile`, `isRecipeMediaReferenced`).
  2. Fixed: a purged URL, image or paste import job's recipe ids that were never stored have their folders swept.
  3. Fixed in part: the purge drops CalDAV's deferred follow-ups (`dn:` hashes). No flow exists and Enrich All only enrolls, so no parent waits on or counts a removed child; a paused queue keeps its jobs in `wait`, already scanned.
  4. Fixed: a recipe entry takes the recipe's name; a note keeps its own title.
  5. Fixed: each post-commit step runs within 30 s; on timeout it logs and the rest run.
  6. Not changed: the recipe-folder cleanup has no age threshold or claim check to copy; it removes a folder with no recipe row at once.
  7. Fixed: the running-job tests wait on the processor's entry; both deadlock tests close the cycle on the intended victim. 30/30 each file.
  8. Fixed: the step-image rows are read before the deletion and checked gone after.
  - Rejected: a claim re-made in the instant of the sweep; a real failure reported as account gone; tokens left when Valkey was down; a 4410 during an ordinary expiry.
