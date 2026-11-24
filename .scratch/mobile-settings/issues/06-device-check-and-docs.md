# 06: Device check, Maestro and docs

**What to build:** Close the set: Maestro flows, a device check, release notes and docs.

**Blocked by:** 02, 03, 04, 05, 07

**Status:** ready-for-agent

- [x] Maestro: open Settings from the avatar menu, edit name, swipe-revoke a site token, create and copy an API key, sign out with nothing unsynced.
- [x] Checked on a device or simulator, light and dark, against the canvas boards.
- [x] 0.28.0-beta release notes and the apps/docs mobile pages updated (written by Terra via `delegate_task`, per `docs/agents/feature-docs.md`).
- [ ] Gates green.

## Comments

### Whole-branch review of tickets 01-05 (2026-11-24, `aecca5857..02f506410`): dispositions

Reviewers: Standards (Haiku), Spec (Opus high), cross-model (Sol high). Run before this ticket because 06 waits on Mike's ticket 03 decision and a free simulator.

Behaviour (Spec and cross-model, deduped):
- fix, bug: saving allergies before their list has loaded replaces the stored set with the new chips (`use-allergies.ts:21` returns `data ?? NONE`; the version comes from the profile cache).
- fix, bug: a write's follow-up runs after the sheet is gone or the 30 s release passed: `token-new-screen.tsx:72` pops another page, the created API key is never shown (`api-key-new-screen.tsx:48`), `password-screen.tsx:63` pops Profile; the password change has no key or busy state, so a double tap sends it twice.
- fix, bug: web's `profile-card.tsx:40` uploads the staged photo after a refused name save, now with a refreshed version, over a newer avatar.
- fix: VoiceOver reads only the title of a row with actions (`settings-row.tsx:158`), so two keys with one name are the same.
- fix, bug: a failed household join or create is silent and empties the field (`no-household-forms.tsx:111`); kick, leave, make admin and regenerate fail silently too.
- fix, bug: the Profile and Allergies Save (`use-draft.ts:26`) skip `settingsWrite`, so no repeat hold and no 30 s release; the photo picker and Save ignore a photo delete in flight.
- fix: the root's Household row says "No household" while loading and Offline without a cache (`settings-screen.tsx:82`).
- fix: web browser tests were never run for the web workflows this branch changed; they run in the final verify.

Standards:
- fix: `addableProviders` and `passwordChecks` are also in web's `sign-in-methods-card.tsx:88` and `change-password-modal.tsx:40` (web hardcodes 8); one shared copy.
- fix: `shareLinkActions` sits in `reader/`; recipes code imports reader internals past the index.
- fix: one vocabulary for "did the write go through" (`tookIt` twice with two meanings, `accepted`, `wentThrough`, `settled`, `sent`).
- fix: pages that go their own way: Household renders nothing while loading and has its own state switch; Allergies and Sign-in methods show empty on a failed read; `useIntl` and `useText` mixed in 13 settings files with three local `t` helpers; five confirm-then-write builders; the Save button and the form field each written three times.
- fix: `settingsWrite(() => void deleteAvatar())()` and `writeBlocked(true, isOffline)`; the three-line comment at `settings-row.tsx:32`; dead `shareSubtitle`; mobile's one-function `household-rules.ts`; API keys still inside `use-account-mutations.ts`; `settings-row.tsx` split from its swipe wrapper; `measurement-choices.ts:9` repeating `measurementSystemTarget`; testIDs named four ways.
- verify: `generatedModal.hint` drawn as visible text on the created-key sheet; kept if the canvas board shows it.
- reject: rename Profile to Account per the glossary (the spec, the tickets and web's keys say Profile).
- reject: one common "Copied" key (the three say what was copied).
- deferred to the ticket 03 decision: `LocaleSaveScope` inside `mobile-i18n-context.tsx`, the repeated `useIsMutating` check in `use-system-conversion.ts`.

Final fix rounds: behaviour in `d5ac6fefa`..`f90123d8e` (seven commits, each bug with a failing test first), structure in `15a7d5d89`..`2976db972` (fifteen commits). Not changed: `shareSubtitle` is still used by `recipe-share-screen.tsx`; the created-key warning stays visible text, as the `StApiKeyCreated` board shows it. testIDs under Settings now follow `settings-<page>-<thing>`.

### Re-review of the final fix range (2026-11-24, `02f506410..2976db972`, Sol high): dispositions

- fix, bug (`d5ac6fefa`): an allergy list restored at v3 can be saved with the profile's v4 and erase an allergy added elsewhere. The allergy write sends the version its own list was read at; a newer version learned elsewhere rereads the list.
- fix, bug (`683ac13ea`): an add-token reply after the 30 s release leaves the sheet open asking for a retry, which adds a second token. A late success that finds its sheet still in front acts as the success it is.
- fix (`7aa8d19a4`): the join and create fields are cleared on the router's early acknowledgment; mobile stops clearing them (the forms leave the page on success).
- fix (`7aa8d19a4`): a household name over 100 characters shows a raw Zod message in mobile's toast; the field stops at the server's limit and validation errors get the generic message.
- fix, bug (`324782265`): the name save and the photo upload share the key `profile-save` and a held repeat returns the first write's result, so a new name can be reported saved with no request sent. One key per kind of write; a repeat while one is in flight is dropped and never reports success.
- fix, bug (`46872c181`): when both initial reads fail, Sign-in methods treats the unread provider list as empty and hides Retry.
- reject: web's failed-write toast hides an expired code's reason behind "technical details" (web's adapter does that for every failure; before this run web showed nothing).
- reject: a join refused after the release shows the timeout toast and then the refusal (both are true, and the second explains the first).
- sound per the reviewer: the other seventeen commits.

Final fix round 2: `4b9e41eb4` (an allergy save sends the version its list was read at), `0cb983ba5` (a late success acts while its sheet is in front), `e860720cc`, `c0279cda5`, `551821046` (one key per kind of write, a repeat is dropped), `64b253fa9`. Two flaky unit tests were fixed on the way: `3e291aac6` (`worklet-closures`) and `cb87cec20` (`join-timers`).

Verification: at `2976db972` all seven gates 0, iOS simulator compile green, web E2E 282 of 282. At `cb87cec20` all seven gates 0, mobile lint at the baseline's 11; web E2E 275 passed, 1 failed, 6 not run: `realtime/realtime.e2e.ts:605` ("a browser back from a network gap gets what it missed through Resume") expected at least 3 and got 2 after 30 s, then passed three times alone. A flake is a bug: sent to a fixer.

Not started in this ticket: the Maestro flows, the device check and the docs. They wait on Mike's ticket 03 decision and on the simulator another session holds.

The realtime flake: not from this branch. Offline, each failed socket attempt doubled a random wait capped at 30 s, so the socket could reopen almost 30 s after the network returned, which is the test's whole allowance. `27c789592` keeps the retry at the first step's delay while the browser reports itself offline (web only; React Native has no `navigator.onLine`). The test failure itself was never reproduced; the delay was (0.1-16 s over 40 cycles before, under 0.93 s after). Mike's to keep or revert.

Closing verification at `27c789592`: all seven gates 0, mobile lint at the baseline's 11, web E2E 282 of 282. iOS simulator compile last green at `2976db972` (no Swift change since).

The run stops here on Mike's decisions (ticket 03's scope, the Outbox exclusion, the silent refused link, Copy link, the stored one-time secrets) and on the simulator another session holds. This ticket's own boxes are all still open.

### Mike's decisions (2026-11-24)

Ticket 03 is fixed here; only secret-carrying writes stay out of the Outbox; the silent refused link is accepted; a share link becomes viewable (ticket 07, which now blocks this one); one-time responses are stored as a marker. Mike says no one else is using the simulator, so this run may take it or stop it. `27c789592` stays unless he says otherwise.

### Device check and Maestro (2026-11-24)

- Ran: Release build on the iPhone 18 Pro simulator; `settings-open`, `settings-profile-name`, `settings-token-delete`, `settings-api-key` (checks the pasteboard through the runner's new `/clipboard`) and `sign-out` each passed 3 of 3 on the final build. The avatar menu is opened by its label: the SwiftUI Host hides `account-avatar` from the accessibility tree.
- Walked every page and sheet light and dark against `StPage`; screenshots in the session scratchpad. Docs screenshots: `apps/docs/static/img/screenshots/mobile-settings*.png`.
- Fixed: swipe circles showed through closed rows (`b0a0de0dd`), the Version row's title clipped to "V…" (`7bf7de8a1`), a square behind the 96 pt avatar (`8151de8d3`), long-press lifted only the avatar (`08b9a2f29`), clipped swipe labels "Make a…", "Delete l…", "Reactiv…" (`ef734bf29`, `8867b4462`, `74bb3161e`), the created-key sheet clipped below the key (`0d58ef01b`).
- Left (not Settings code): at accessibility-large and up the avatar drops out of the Recipes header's "…" overflow, so Settings is unreachable; the join-code placeholder says "8-character code" for a 6-digit code (shared with web, all locales); token, key and share-link lists changed elsewhere stay stale until relaunch.
- Left (design): the canvas names the key sheet "New API key" with "Create" (app: "Create key" twice); delete-account's native alert cannot colour its lines; allergy chips are solid orange where the canvas tints them.

### Gatekeeper notes on the device part and the docs (2026-11-24)

Device agent (`b0a0de0dd`..`dd3084fd3`), on the iPhone 18 Pro simulator (the leftover runner on the 18 Pro Max was not touched). Dispositions of what it left:
- fix (closing fixer, `4f4511659`): the join-code placeholder said "8-character code"; a code is six digits.
- fix (closing fixer, `693556c9a`): the token, key and share-link lists stayed stale until relaunch; they reread when their page opens.
- left, for Mike: from accessibility-large Dynamic Type up the avatar drops out of the Recipes header, so Settings cannot be reached (header code beside the other session's `account-menu.tsx`); `account-avatar`'s testID does not reach the accessibility tree (same file), so the flows open the menu by its label.
- left, design judgement for Mike: "Create key" where the canvas says "New API key" and "Create"; solid orange allergy chips where the canvas tints them; the native delete-account alert cannot colour its lines.
- not seen: the quick-tap dimming (read in the native code only).
- the docs screenshots show the Maestro account ("Maestro", `maestro@norish.test`, `localhost:59193`, 0.27.0-beta), not a staged "Alex Cook" one.

Docs (Terra, `1d0a6e7e0`): `mobile.md` (still `draft: true` until TestFlight) and the 0.28.0-beta release notes. Root `format:check` 0, docs build 0. The docs workspace's `pnpm format` exits 1 on eight older release-note files this run did not touch (only `0.28.0-beta.md` changed under release notes).

The closing review of tickets 03, 05 and 07 and its fixes are logged at the end of ticket 03.
