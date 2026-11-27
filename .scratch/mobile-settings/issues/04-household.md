# 04: Household

**What to build:** The Household sub-page (`StHousehold`, `StHouseholdMenu`, `StHouseholdSwiped`, `StKick`, `StLeave`, `StNoHousehold`), mirroring web's household cards on `useHousehold` / `useHouseholdMutations`.

**Blocked by:** 01

**Status:** done

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

### Review round 1 (2026-11-23): dispositions

Standards (Haiku):
- fix: `joinCodeStatus`, `memberActions` and `leaveWarns` copy rules from web's `join-code-card.tsx:46-54`, `members-card.tsx:76` and `household-info-card.tsx:67`; one copy beside `useHousehold` in shared-react, used by both apps. That also ends the rule importing `SettingsActionKind`.
- fix: the ticker helpers (`noTick`, `nowToTheSecond`, `everySecond`) copy web's; one shared copy.
- fix: the kick and make-admin `confirm({...})` branches are near-identical; one path.
- fix: a prefixed `t` written four times and full ids mixed in; `useText` with full ids throughout.
- fix: copy-and-toast written here and in `recipe-share-screen.tsx:61-65` with different error handling; one helper.
- fix: `householdState` / `adminViewOf` duplicate `isAdmin`; `memberActions(bool, bool, bool)` takes named fields; `EntryForm` builds i18n keys from an `id` template.
- verify: `recipes.actions.share` borrowed for the Share label; a common key if one exists.

Spec (Opus medium): no missing requirement, no scope creep.
- fix, bug: the join field accepts anything while the server strips non-digits and cuts to six ("1234567" joins 123456, "abc" throws a raw Zod error); six digits, number pad.
- fix, bug: a confirm accepted after the connection dropped still fires and is queued; settings writes re-check Offline when they run.
- fix: a failed household load shows the create-or-join forms to a member.
- fix: Create and Join stay enabled while their request is pending.
- fix: the countdown interval keeps running after the code expired; Make admin's confirm is styled destructive.

Round 1 outcome (`02717e74e`..`f5423ea0e`): 12 of 13 fixed; the Share label keeps `recipes.actions.share` (no common key exists). Exit gates all 0 at `f5423ea0e`, mobile lint 11.

### Review round 2 (2026-11-23): fix range `ef2324a11..f5423ea0e` (Sol medium)

- fix, bug (`02717e74e`): `maxLength={6}` applies before non-digits are stripped, so a pasted "123-456" leaves five digits.
- fix (`e7ddd53b7`): the photo upload after a name save, avatar removal, password change, the allergy Save and every preference write bypass `useSettingsWrite`.
- fix, bug (`c71419698`): a failed refetch replaces the create-or-join forms with Retry when the last good read said "no household".
- fix, bug (`02f831863`): the pending flags are read from the render, so two presses before React commits both send.
- fix, bug (`8f66f3636`, `5c8b4ea56`): the shared clock still starts an interval on every rerender after expiry, on both apps.
- fix, bug (`651f1f531`): removing the "redundant" admin check lets a viewer demoted from another device keep the admin's code card (the realtime patch keeps the cached code fields).
- ask (already open): a write whose connection drops mid-request is still captured by the Outbox; only `households.join` is in `uncaptured.ts`.
- sound per the reviewer: `f661cfeaa`, `9c2c1c7db` (web unchanged), `3113a2ccb`, `d4a6bcca4`, `1cd017b29`.

Round 2 outcome (`b09297608`..`e1972e8e0`): all six fixed, each bug with a failing test first. Exit gates all 0 at `e1972e8e0`, mobile lint 11. `91e184f3a` does not typecheck alone (a stale test line removed in `81aaa56c4`).

### Review round 3 (2026-11-23): fix range `f5423ea0e..e1972e8e0` (Sol medium)

- fix, bug (`c5ee8b037`): the shared in-flight guard is released by a per-call `onSettled`, which TanStack detaches when a second call overlaps, so a failed kick can never be retried; and web's join form clears a corrected code the guard dropped. Decision: the guard leaves the shared hook (web back to its baseline) and lives in mobile's `useSettingsWrite`, released in `finally`.
- fix, bug (`799dbd90b`): a code that expired within the current second shows `0:00` and stays copyable until another render (the display clock rounds down, the timer check does not).
- fix, bug (`e1972e8e0`): `useOfflineNow` reads a ref an effect updates, so a form that unmounted mid-save still reads Live and starts the photo upload.
- sound per the reviewer: `b09297608`, `91e184f3a`, `81aaa56c4`.

Round 3 outcome: fixed in `7125453c8` (the repeat guard is `settingsWrite` in `utils/settings-write.ts`, keyed per write and per member; web's hook is back to its pre-guard state, its actions now resolve a boolean web ignores), `2749b1482` (one clock for the countdown and the timer) and `a44ce9380` (`isOfflineNow` from the root ConnectivityProvider). Exit gates all 0 at `a44ce9380`, mobile lint 11. No fourth re-review: the final whole-branch pass reads this ticket.

Open: a write whose connection drops mid-request can still be captured by the Outbox (ask, shared with tickets 03 and 05).
