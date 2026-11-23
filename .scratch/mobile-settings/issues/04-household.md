# 04: Household

**What to build:** The Household sub-page (`StHousehold`, `StHouseholdMenu`, `StHouseholdSwiped`, `StKick`, `StLeave`, `StNoHousehold`), mirroring web's household cards on `useHousehold` / `useHouseholdMutations`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Members listed with the admin marked; the admin gets Kick (red) and Make admin (green, hands admin over: `transferAdmin`) by swipe and long-press, each with a confirm; others get no actions on members.
- [ ] Join code shown with copy and share, and regenerate for admins as on web.
- [ ] Leave household with a confirm, as `household-info-card.tsx` does.
- [ ] No household: create one or join with a code.
- [ ] Realtime: a member joining or leaving shows without a refresh.
- [ ] Gates green.

## Comments
