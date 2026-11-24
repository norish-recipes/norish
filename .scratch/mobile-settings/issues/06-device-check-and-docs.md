# 06: Device check, Maestro and docs

**What to build:** Close the set: Maestro flows, a device check, release notes and docs.

**Blocked by:** 02, 03, 04, 05

**Status:** ready-for-agent

- [ ] Maestro: open Settings from the avatar menu, edit name, swipe-revoke a site token, create and copy an API key, sign out with nothing unsynced.
- [ ] Checked on a device or simulator, light and dark, against the canvas boards.
- [ ] 0.28.0-beta release notes and the apps/docs mobile pages updated (written by Terra via `delegate_task`, per `docs/agents/feature-docs.md`).
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
