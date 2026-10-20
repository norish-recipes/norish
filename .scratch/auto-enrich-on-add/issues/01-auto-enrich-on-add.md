# 01: An add can turn off automatic AI

**What to build:** One profile choice, `autoEnrichOnAdd`. It is on at the start. Each add area has a switch. The switch starts from the choice. A person can change it for one add. An add with the switch off starts no automatic enrichment. Manual enrichment works. See `.scratch/auto-enrich-on-add/spec.md`.

**Blocked by:** None

**Status:** done

- [x] `UserPreferencesSchema` gets `autoEnrichOnAdd` as an optional true/false value. An unknown value reads as absent. `getAutoEnrichOnAddPreference` reads absent as on.
- [x] `UpdateUserPreferencesInputSchema` accepts the key and rejects a value that is not true or false. The change writes only the keys that it gets.
- [x] The profile query returns the choice. An old change returns the profile choices, and this one is there.
- [x] The Preferences area shows a switch with a label and a short note. The switch saves through `updatePreferences` and shows the value. An absent value reads as on.
- [x] The URL, Paste and Image options and the recipe form show a switch. It starts from the profile choice. A change lasts for that add. A new open starts from the choice again.
- [x] The URL, Paste, Image and create procedures accept an optional `autoEnrich`. An absent value reads the profile choice of the person. Then each program that uses the API gets the same standard.
- [x] The choice is part of the import job and the create event. The `recipeBecameUsable` data gets an optional `autoEnrich`. The data of old jobs does not change.
- [x] The enrichment program starts the six Enhanced kinds. It does this when the value is absent or true. It stops the work when the value is false, for that recipe only. Other recipes do not change.
- [x] `allergy-detection` is a manual action only and is not in the six.
- [x] Manual enrichment for each kind does not change and does not read the automatic controls.
- [x] Tests cover the standard, the check, the write and the query.
- [x] Tests cover the settings switch, the add controls and one start when on.
- [x] Tests cover no start when off, the absent value and the job event.
- [x] Tests cover the six kinds and no automatic `allergy-detection`.
- [x] The release notes and the recipes help show the choice and the per-add switch.

## Known gap

- **Recipe file import:** The recipe file import does not have the value. It keeps its automatic start. A later change can add the choice there.

## Not done now

- **Screenshots:** The settings switch and the per-add switch need a Playwright run. Add the images to `apps/docs/static/img/screenshots/` and to `apps/docs/docs/recipes/enrichment.md` when the Playwright tests run.
