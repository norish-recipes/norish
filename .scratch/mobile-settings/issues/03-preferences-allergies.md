# 03: Preferences and allergies

**What to build:** The Preferences sub-page (`StPreferences`, `StPreferencesMenu`, `StPreferencesHidden`) and the Allergies sub-page (`StAllergies`), mirroring web's preferences and allergies cards.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Preferences: account-wide choices (measurements menu and the rest web's card has) and an "On phones" group of Device Preferences (the phone Device Kind), including Hidden items as checkmarks.
- [x] A change applies everywhere it shows in the app without a restart.
- [x] Allergies: pick and remove allergies, Save button; recipes' allergy warnings follow.
- [x] Gates green.

## Comments

- Preferences is `PreferencesForm` over `preferences-rules.ts` (tested): "Your account" (Language via `setLocale`, After planning, Measurements; AI choices only where AI is on), "On phones" (Today section, Recipe page colour, Units) and Hidden items as checkmarks (timers hidden when the deployment has them off; unknown stored names carried). Choices are `ChoiceRow`s: a `native-menu` tap menu with the chosen option ticked by its SF Symbol (the module has no trailing check). Web's per-row descriptions are left out (no text under a field); web's keys are reused, plus `settings.mobile.accountGroup` and `phonesGroup` in all locales.
- Allergies is `AllergiesForm` over `allergy-rules.ts` (tested), built on 02's rules: the draft survives everything but its own successful save (`afterSave`, now exported), is compared with the saved set as web does, drops itself when it would send nothing, and a stale or refused save keeps it. `useAllergiesMutation().setAllergies` now resolves whether the server took it and a stale answer says "changed elsewhere" (web too); test beside the others. Suggestions come from `useTagsQuery`, as web's TagInput. `SettingsPage` gained `keyboardShouldPersistTaps="handled"` and `automaticallyAdjustKeyboardInsets`.
- Rereads, checked by grepping every mobile reader: recipePageColor (recipe and cook-mode screens), todaySectionVisibility (recipes screen), unitStyle (`useUnitFormatter` in ingredients, steps, cook and add-to-groceries; the editor form), hiddenItems (`useHiddenItemVisibility`, `useTimersEnabledQuery`, ingredient icons, search filters), afterPlanning (`use-plan-exit` via `useReader`), allergies (`useActiveAllergies` in the recipe header and menu). All read the query cache through shared-react hooks the writes update; shared-react's "re-renders only the readers of the preference that changed" covers the reread. Mobile has no reader of the measurements choice or the `conversion` Hidden Item (no conversion control yet), so those apply once one exists.
- Offline: every row, chip, suggestion and Save is off and nothing is queued. Not done: menus, the Save flow and keyboard insets are untested on a device. Docs writer: Preferences page (account vs phone choices, Hidden items) and Allergies page on mobile.

### Review round 1 (2026-11-23): dispositions

Standards (Haiku):
- fix: `measurementChoices` and `offeredHiddenItems` copy web's `preferences-card.tsx:61-69`; one shared copy both apps use.
- fix: the stale-write refusal block is in `use-allergies.ts` and `use-account-mutations.ts`; one helper.
- fix: the Allergies draft-and-save rules mirror the Profile ones (`keptAllergyDraft`, `canSaveAllergies`, `saveAllergies`, the render-phase reset); one draft-save shape for both, which also ends the overloaded `null` in `allergiesToSend`.
- fix: `ChoiceRow` repeats the menu-with-checkmark pattern of `recipe-share-screen.tsx:146-159`; one component.
- fix: `ChoiceRow` passes its chevron as `trailing`; `SettingsRow`'s `accessory` gains it.
- fix: the `text = (id) => intl.formatMessage({ id })` helper twice; the unnamed `/[\s,]$/`.
- fix: the accessibility label joins title and value with a hard-coded ", "; label and value go in their own props.
- reject: share web's `TagInput` (a DOM component; the reviewer's grep found no mobile chip input to reuse).

Spec (Sol medium):
- verify, bug: Language written through `setLocale` can be reapplied to the old language by `use-user-locale-sync.ts` before the save lands.
- verify, bug: After planning and Measurements keep `version: input.version` on a stale answer, so a retry stays stale; an account preference save can make the next allergy save stale.
- verify, bug: a Hidden rating or favourite filter stays applied in the library (`use-library-list.ts:19`); a changed Measurements choice is not reapplied to an already-evaluated recipe (`use-system-conversion.ts:107`).
- verify, bug: a case-only allergy edit counts as dirty; personal allergy chips do not follow a change from another device.
- verify: a write in flight when the network drops can reach `captureToOutbox`; the spec says Settings writes never enter the Outbox. Report before changing if the allow-list holds these on purpose.
- reject: a draft saved with the latest version can overwrite an allergy added elsewhere (web's card saves its whole local set the same way, and the ticket mirrors web); checked against web by the fixer.
- reject: `keyboardShouldPersistTaps="handled"` on `SettingsPage` changes Profile (it makes Save and Remove photo answer the first tap with the keyboard up, which is what a form wants).

Round 1 outcome (`91d1d4297`..`fc285dfce`, 13 commits): every Spec claim held and was fixed with a failing test first, except the Outbox one. Structure findings fixed in `180bd7c58`, `eb5e94287`, `e733541cb` (`useDraft` + `draft-rules.ts`), `bb697d27e` (`ChoiceMenu`), `d60ab03cc` (`useText`, 16 copies app-wide). Web's card saves its whole set like mobile, so that rejection stands. Exit gates all 0 at `fc285dfce`, mobile lint 11, iOS compile green.

Ask: the spec's "Settings writes never enter the Outbox" contradicts CONTEXT.md:375 ("Admission is universal"); `engine.ts` has no allow-list, so a settings write in flight when the network drops can be queued. Nothing changed.

### Review round 2 (2026-11-23): fix range `5bac75180..fc285dfce` (Sol high)

- fix, bug (`91d1d4297`): profile and language saves read the version from the profile cache alone, and a rollback restores a whole snapshot that can lower the version a sibling save installed.
- fix, bug (`24db83056`, `eb5e94287`): a failed language save keeps the optimistic language when the reread fails or the preference was unset; the avatar picker skips the saving flag; a stale language answer reverts without saying why.
- fix, bug (`e7d3cfa6e`): Apply erases a stored filter whose Hidden Item is hidden, so un-hiding restores nothing; both Library badges still count the suppressed filter.
- fix, bug (`7b6980694`): the conversion hook does not record the choice through Off, so Metric → Off → manual US → Metric skips; an optimistic choice can start a conversion that a failed save then leaves behind.
- fix, bug (`c00ba48c4`): `storedTags(saved)` cleans stored names a second time (`&lt;milk&gt;` → `<milk>` → empty), so removing that chip leaves Save off.
- fix, bug (`b02cf5b35`): the own-allergies reread fires on every household client for any member's save and the subscription wrapper reschedules it. Only for the reader's own change, or reverted.
- sound per the reviewer: `180bd7c58`, `e733541cb`, `bb697d27e`, `d60ab03cc`, `0d2623b5b`, `fc285dfce`.

Round 2 outcome (`8c4e28adf`..`a63087189`): all six fixed with a failing test first; the own-allergies reread is reverted (the event carries only the household's combined list). Exit gates all 0 at `a63087189`, mobile lint 11.

### Review round 3 (2026-11-23): fix range `fc285dfce..a63087189` (Sol high). Not converged: waiting on Mike

Eight high-confidence findings, none in the Settings pages themselves:
- `aaf56d921`: a delayed allergy reply writes its own version over a newer one both caches learned meanwhile.
- `5b0205cd2`: a stale language save's rollback is undone by the sync effect (the server's language shows); the avatar picker can queue an Offline language write (the Outbox ask above); web's navbar label advances on a refused second save.
- `18d1c7bc3`: web's server seed (`recipe-filters-server.ts:26`) still applies a hidden filter, so a reload fetches twice.
- `ecc958adb`: a manual conversion made while any preference save is in flight is overridden when it settles.
- `36c827066`: re-saving drops a stored `<milk>` (the server strips tags on every save); before this ticket too.
- `8c4e28adf`: an emptied household allergy list falls back to the device's stale own list; before this ticket too.

Decision asked: keep fixing these here, or revert the library-filter and auto-conversion fixes (`e7d3cfa6e`, `18d1c7bc3`, `7b6980694`, `ecc958adb`) into their own ticket and finish only the version and language ones here. Tickets 04 and 05 do not depend on the answer and go ahead.

### Mike's decision (2026-11-24)

Keep fixing here: all round 3 findings are fixed in this ticket, nothing is reverted into its own ticket. The fix round runs on Opus high (two rounds on lower tiers did not converge).

### Round 3 outcome (2026-11-24)

- Versioned writes: a reply older than the version a cache holds is dropped whole, so neither cache's version ever goes down (`outdated` in `use-profile.ts`, used by every profile and allergy write). The server keeps a stored allergy tag a save sends back; an emptied household list stands over the own list.
- Language: what shows is the profile cache's saved language, else the device's own; the rollback and `useUserLocaleSync` are gone. Web's navbar label reads the saved language too. `LocaleSaveScope` has its own module.
- Hidden Item filters: `withoutHiddenFilters` lives in `hidden-items.ts`, and the client and the server seed (`readRecipeQueryFilters`) both apply it.
- Auto-conversion: acts once per recipe and confirmed choice; a pick by hand counts as acting on the choice confirmed next. `usePreferencesSaving` is the one in-flight check.
- Not done: the avatar menu's language picker is not disabled while Offline (`account-menu.tsx`, which another session is editing). A pick there while Offline is saved optimistically and can be queued.

### Review round 4 (2026-11-24): fix range `1c8d71496..8f3aef654` (Sol high): dispositions

Sound per the reviewer: the Library seed and client agree on Hidden Items; stored allergy names survive a resave; web's label no longer advances on a refused second save. Eight new findings, all fix:
- fix, bug: a rename's late reply is dropped once an allergy save raised the held version, and nothing rereads, so the new name never shows (`use-profile.ts:83`).
- fix, bug: the server labels an allergy list with a version read in a second query (`user-allergies.ts:11`), so a stale list can carry a newer version and undo a clear.
- fix, bug: a failed language save restores its whole earlier snapshot over a language saved elsewhere meanwhile (`use-account-mutations.ts:126`).
- fix, verify: an Offline language pick from the avatar menu rolls back on screen but stays queued in the Outbox. Fixed in the shared save (a queued write keeps its optimistic value); `account-menu.tsx` is the other session's and is not touched. A queued language write itself is fine (Mike: only secrets stay out of the Outbox).
- fix, bug: a language saved while the first profile read is pending is dropped when the reply arrives first (`use-profile.ts:77`).
- fix: mobile now stores the fallback language as if the reader chose it (`mobile-i18n-context.tsx:173`).
- fix, bug: a failed manual conversion still counts as "by hand" and blocks the preference that then succeeds (`use-system-conversion.ts:119`).
- fix, bug: creating a household seeds `allergies: []`, which now hides the reader's own allergy warnings until a household read (`use-household-mutations.ts:49`).

Fix round 4 runs on Sol high (a change of model family: Opus has fixed three rounds), reviewed by Opus high.

### Round 4 outcome (2026-11-24)

- The profile and allergy caches reread after dropping an older reply or receiving a write reply before the first read. A failed preference save rolls back only fields that still hold its optimistic value at the same version.
- Profile and allergy replies read data and version together. Preference saves return the version committed by the update.
- Mobile stores explicit language choices and keeps an optimistic language when the Outbox accepts it. Older device entries are kept because they carry no record of how the language was selected.
- Automatic conversion yields only to a manual conversion the server confirms. Household creation keeps the Reader's own allergy warnings until the household is read.
- E2E runs later with the rest of Mobile Settings.

### Review round 5 (2026-11-24): fix range `40742be9d..0ddcd861e` (Opus high): dispositions

Holding per the reviewer: the server reads a version with the data it labels; the language rules (explicit choice only, rollback of its own value only, a queued save keeps its value); only a confirmed manual conversion counts as made by hand; the profile and allergy caches. Left to fix:
- fix, bug: a preference saved before the first profile read answers is sent at version 1 and refused as stale (`use-profile.ts:74`); round 4's test faked the server's answer. The write waits for the read.
- fix, bug: a stale conversion reply restores the earlier recipe snapshot over a newer edit (`use-convert-mutation.ts:96`). No snapshot rollback on stale: reread.
- fix: round 4 made `recipes.convertMeasurements` wait for the whole AI conversion and answer `{success, stale?}` (`recipes.ts:780`), which nothing asked for: an Outbox replay can run the AI conversion again, up to three times. The router goes back to its early answer and the result by event; "made by hand" is read from the confirmed result.
- fix, bug: only the language keeps its optimistic value when the Outbox queues a save (`use-account-mutations.ts:158`); the other preferences roll back on screen and are applied later.
- verify: the name and avatar replies now carry `preferences`, which `mergeUser` spreads over the cache; they must not overwrite a pending optimistic preference.
- reject: `user.get` no longer falls back to the session's image when the stored one is null (a deleted avatar must not come back from the session's copy).
- reject: `updateUserPreferences` without a version on a missing user answers stale (there is no such caller).

Fix round 5 runs on Opus high after ticket 07's implementer (one writer at a time).

### Round 5 outcome (2026-11-24)

- A versioned write (preferences, name, avatar) sent before the first profile read waits for it and sends its version; the test's fake server refuses a wrong version. Allergies already send only from their own read. Every preference save the Outbox queued keeps its optimistic value without an error.
- Name and avatar replies carry no preferences again, so they cannot overwrite a preference save still in flight.
- `recipes.convertMeasurements` answers early again and reports its result by event; the `converted` event keeps the reread recipe. A conversion ends once the recipe moves past the version it was asked on, or on the `failed` event. A manual pick counts as made by hand once the server's newer recipe shows it.
- A failed conversion undoes only its own switch on the same version; a newer recipe is left alone and reread.
