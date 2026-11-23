# 04: Household

**What to build:** The Household sub-page (`StHousehold`, `StHouseholdMenu`, `StHouseholdSwiped`, `StKick`, `StLeave`, `StNoHousehold`), mirroring web's household cards on `useHousehold` / `useHouseholdMutations`.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Members listed with the admin marked; the admin gets Kick (red) and Make admin (green, hands admin over: `transferAdmin`) by swipe and long-press, each with a confirm; others get no actions on members.
- [x] Join code shown with copy and share, and regenerate for admins as on web.
- [x] Leave household with a confirm, as `household-info-card.tsx` does.
- [x] No household: create one or join with a code.
- [x] Realtime: a member joining or leaving shows without a refresh.
- [x] Gates green.

## Comments

- Household page is `HouseholdScreen` (name and role, `MembersList`, `JoinCodeCard`, Leave) and `NoHouseholdForms`, over `household-rules.ts` (tested): Kick and Make admin only for an admin on others, each behind `useConfirm` with web's text; the code card shows only on the admin DTO, with a live countdown, Copy (expo-clipboard), Share (`Share.share`) and Regenerate or Generate. Web's i18n keys are reused; nothing added to shared-react.
- Realtime: `useHouseholdSubscription` is already mounted in `_layout.tsx`'s `AuthenticatedEffects` and patches the `households.get` cache that `useHousehold` reads, so the list follows joins and leaves (shared-react's subscription test covers the patches). Kicked or left sets the cached household to null, which renders the create-or-join forms, not an error.
- Offline: Leave and Regenerate are `write` rows, swipes and the menu are off, Create and Join fields and buttons are off; Copy and Share stay live (no write). Nothing queues from this page.
- Deviations: web's join code is a six-digit OTP input; mobile uses a plain field (only empty is refused, as the mutation does). Not done: swipe, long-press, Share and the keyboard flow are untested on a device.
- Docs writer: Household page on mobile (members, kick and hand over admin, join code copy and share, leave, create or join).
