# 01: Every account has a household

**What to build:** Every account is in exactly one household. Sign-up creates a household of one with the person as its admin, and leaving or being removed puts the person straight into a new household of one. Code reads the household by id instead of by member lists. See `.scratch/household-boundary/spec.md`, "Households".

**Blocked by:** none

**Status:** ready-for-agent

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
