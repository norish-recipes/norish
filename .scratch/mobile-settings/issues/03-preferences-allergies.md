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
