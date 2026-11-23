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
