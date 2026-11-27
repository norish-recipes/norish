# 01: Every account has a household

**What to build:** Every account is in exactly one household. Sign-up creates a household of one with the person as its admin, and leaving or being removed puts the person straight into a new household of one. Code reads the household by id instead of by member lists. See `.scratch/household-boundary/spec.md`, "Households".

**Blocked by:** none

**Status:** done

- [x] **Migration:** every account without a household gets a household of one, named the way a new one is.
- [x] **Sign-up** creates the household of one. This covers every Sign-in Method, including the first user who becomes server owner (`packages/auth/src/auth.ts`).
- [x] **Leaving and removal** (`packages/trpc/src/routers/households/households.ts`) end in a new household of one instead of no household. A household admin still hands the role on before leaving.
- [x] **Joining** from a household with other members stays as it is today. Joining from a household of one is ticket 09: until then, refuse it unless the household of one holds nothing but its member.
- [x] **The household is read by id:**
  - the tRPC context carries `householdId`;
  - `householdUserIds`, `viewerAndHouseholdIds` and every "no household" branch go, on the server, in `packages/shared-react` and in both apps' household screens;
  - `householdKey` is the household id.
- [x] **Realtime:** the household channel is keyed by household id (`packages/shared-server/src/realtime/domain.ts`). Joining, leaving, being removed and deletion still emit a Scope Change (ADR-0033).
- [x] **Household screens:** the web household settings and the mobile household screen show "your household (just you)" with its join code, instead of "create or join".
- [x] **Tests:** repository and router tests for sign-up, leave and remove. E2E: a new account lands in a household of one, and a removed member lands in a new one.

## Comments

- Sign-up's household of one comes from an `AFTER INSERT ON "user"` trigger (migration 0088), so it shares the user's transaction for every Sign-in Method; `uq_household_users_user_id` enforces one household per account (an account in two keeps its first, emptied households go). Leave/remove/join each run in one repository transaction.
- New households are named "My household"; a trigger-made one has no join code until its admin generates one. `households.create` is gone, and leaving a household you are alone in is refused.
- OIDC claims now place only a household of one: join the claimed household (same refusal as joining), or rename it to the claim when none has that name.
- `ctx.userIds` (the household's member ids) stays for the user-id-keyed queries ticket 02 moves to `household_id`; repositories filter by a `household_users` subquery on the household id.
- Not done: the E2E specs typecheck and lint but were not run. ADR-0032 ("a household-less user's household key is their user id") and ADR-0033 ("household key") still describe the old keying, left for the docs writer.
- Review round 1:
  1. fixed: every `assertHouseholdAccess` caller passes `ctx.householdId`; a Pantry test runs the real guard.
  2. fixed: join and move lock the households they touch in id order and re-check admin and last member under the lock; a race test pins it. A move no longer deletes an emptied household (leaving one is refused).
  3. fixed: migration 0088 hands an admin role whose holder no longer lives there to the longest-standing member; fixture, invariant and full-row rerun check added.
  4. fixed: a claim equal to the default household name is ignored and logged. Other widening found: an account alone in a household it made or was left alone in was skipped before; now the claim renames that household or joins it to the claimed one.
  5. fixed: cache invalidation and the Scope Change run in a `finally` after the announcements.
  6. not changed: the only Job Scheduler (`scheduled-tasks`) carries `{ taskType }`, and the long-delayed CalDAV jobs carry no household; jobs with `householdId` retry within seconds.
  7. not changed: a code expired after 10 minutes already reached the screens as no code, so a household of one shows the same "Generate" state.
  8. fixed: web join slots map a module constant; the mobile form has no slots.
  9. fixed: `announceHouseholdJoin` in `shared-server/realtime/household-membership.ts`, used by the router and the claim processor.
  10. fixed: `publishHouseholdTo` in the households router.
  11. fixed: `getHouseholdMemberIdsByHouseholdId` / `getHouseholdMemberIdsByUserId`.
  12. fixed: both live in `repositories/household-members`; the re-export is gone.
  13. fixed: the claim processor reads member ids directly.
  14. not changed: the rules (`isJoinCode`, `joinCodeDigits`) are already shared; each app keeps only a `useState` and its own JSX.
  - rejected: default-name literal in migration SQL (SQL can't import the constant); HELD_BY_MEMBER table list (interim, ticket 09 removes it).
- Review round 2:
  1. fixed: `deleteAccount` locks the household and hands the admin role on, or erases a household of one, in the deleting transaction; race test.
  2. fixed: `transferHouseholdAdmin` locks and re-checks admin and membership; race test.
  3. fixed: `joinHousehold(userId, { joinCode })` checks the code and its expiry under the lock and returns the members it joined; race test.
  4. fixed: `renameHouseholdOfOne` renames only while still a household of one, under the lock; race test.
  5. fixed: a default-name claim is dropped before the first claim is picked.
  6. fixed: `announceHouseholdJoin` reads the joiner's name inside the guarantee.
  7. fixed: confirmed; the cache drops first, then announcements, then the Scope Change, which runs even when either throws; timeline test.
  8. fixed: lock waits count only this suite's database's client backends.
  9. fixed: the rerun compares whole `households` and `household_users` rows.
  - rejected: interim holds-nothing check racing inserts (ticket 09 removes it); claims matching by name (pre-existing, asked of the maintainer).
- Review round 3:
  1. fixed: a household of one made by leave or removal has no join code, so nothing under the lock reaches the pool; a pool-exhaustion race test.
  2. fixed: the move returns who stays, read under its lock; leave and kick announce and drop the cache for them.
  3. fixed: joining, renaming and deleting retry in a fresh transaction when the account moved before its lock landed; avatar files are swept after the delete commits.
  4. fixed: `joinHousehold(userId, { householdId, name })` refuses the join when the name changed under the lock.
  5. fixed: the E2E cleanup deletes through `deleteAccount`; `deleteHousehold` and `deleteUser` are gone.
  6. fixed: both apps show each join refusal in the reader's language, mapped in `use-household-mutations` from `@norish/shared/lib/join-refusals`.
  7. fixed: migrations run in one transaction (drizzle's migrator), so the trigger now comes before the backfill.
  8. fixed: the test holds the household lock itself, each operation must wait behind it (`pg_blocking_pids`), and every settlement and the invariant are asserted; each race test fails with its lock removed, except the deletion-after-own-join test, which pins the retry.
  - rejected: own expired code answers already-member; interim holds-nothing check; claims matching by name (asked of the maintainer).
- Review round 4:
  1. fixed: joining, renaming and deleting try three fresh transactions (`MOVED_ATTEMPTS`), then the join answers `shared`, the rename nothing, and the deletion throws; a test moves the account before each lock lands.
  2. fixed: the join's name re-check reads under the lock in SQL with `householdNamed`, the expression `findHouseholdByName` uses.
  3. fixed: the web join button stays disabled until `isJoinCode` passes; the router answers a malformed code with the `gone` refusal ("Invalid join code") through the shared mapping; a card test and a router test.
  4. fixed: the race helper's lock wait fails after 3 s with what it waited for; a failed wait rolls the test's transaction back and a `finally` settles the started operations.
  - rejected: no join code after leave or removal (decided, same as sign-up).
- Full E2E fix (75630f1f3): the admin users list shows a new account's "My household", as every account has one; the "No household" copy was already gone from every locale.
