# 01: Every account has a household

**What to build:** Every account is in exactly one household. Sign-up creates a household of one with the person as its admin, and leaving or being removed puts the person straight into a new household of one. Code reads the household by id instead of by member lists. See `.scratch/household-boundary/spec.md`, "Households".

**Blocked by:** none

**Status:** ready-for-agent

- [ ] **Migration:** every account without a household gets a household of one, named the way a new one is.
- [ ] **Sign-up** creates the household of one. This covers every Sign-in Method, including the first user who becomes server owner (`packages/auth/src/auth.ts`).
- [ ] **Leaving and removal** (`packages/trpc/src/routers/households/households.ts`) end in a new household of one instead of no household. A household admin still hands the role on before leaving.
- [ ] **Joining** from a household with other members stays as it is today. Joining from a household of one is ticket 09: until then, refuse it unless the household of one holds nothing but its member.
- [ ] **The household is read by id:**
  - the tRPC context carries `householdId`;
  - `householdUserIds`, `viewerAndHouseholdIds` and every "no household" branch go, on the server, in `packages/shared-react` and in both apps' household screens;
  - `householdKey` is the household id.
- [ ] **Realtime:** the household channel is keyed by household id (`packages/shared-server/src/realtime/domain.ts`). Joining, leaving, being removed and deletion still emit a Scope Change (ADR-0033).
- [ ] **Household screens:** the web household settings and the mobile household screen show "your household (just you)" with its join code, instead of "create or join".
- [ ] **Tests:** repository and router tests for sign-up, leave and remove. E2E: a new account lands in a household of one, and a removed member lands in a new one.
