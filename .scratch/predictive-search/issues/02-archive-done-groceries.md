# 02: Clearing done groceries archives them

**What to build:** "Delete done" archives the done groceries it clears instead of deleting them. Archived Groceries leave the list for every member and are kept until the nightly cleanup ages them out. See the spec, "Archived Groceries".

**Blocked by:** `.scratch/household-boundary/issues/02-household-things-belong-to-the-household.md`

**Status:** ready-for-agent

- [ ] **Archive:** `deleteDoneInStore` (`packages/db/src/repositories/groceries.ts`) and its router (`packages/trpc/src/routers/groceries/groceries.ts`) mark rows archived instead of deleting them. Labels stay as they are.
- [ ] **Off the list everywhere:** the list read, pricing (`packages/trpc/src/routers/stores/pricing.ts`) and every other grocery read leave archived rows out. Realtime tells other members the rows left, as for a delete.
- [ ] **Deletes stay deletes:** single delete and selection-mode Delete still hard-delete.
- [ ] **Cleanup:** `deleteDoneGroceriesBefore` still deletes done, non-recurring rows older than `SCHEDULER_CLEANUP_MONTHS`, archived or not.
- [ ] **Tests:** clearing keeps the rows and hides them from the list, pricing and a second member; single delete removes the row; the cleanup removes an old archived row and keeps a recent one. E2E: clear done on web, the list empties for both members.
