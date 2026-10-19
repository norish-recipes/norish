# Automatic AI on add

Status: done

## Problem

Norish starts the Automatic Recipe Enrichment when a person adds a recipe. The person cannot stop this work for one recipe. The Add Recipe options show no sign of the AI work.

The person who adds the recipe makes the choice. The choice must not change other adds. The choice must not remove Manual Recipe Enrichment.

## Solution

Add one profile choice, `autoEnrichOnAdd`. Store it in the `users.preferences` jsonb file. If the value is absent, it is on. Then each profile keeps its operation.

- The **Settings => User => Preferences** area has a switch. A short note explains it. The switch uses the `user.updatePreferences` procedure.
- The URL, Paste and Image options and the recipe form have a switch. It starts from the profile choice. The person can change it for one add.
- The import or create procedure reads the choice. If the person does not give a choice, the procedure reads the profile choice. The choice is part of the job. The job puts it on the `recipeBecameUsable` event. The enrichment program starts the six Enhanced kinds. It does this when the event does not have `autoEnrich: false`.
- Manual enrichment does not read the value. The recipe actions list keeps each kind action, including `allergy-detection`.

## Why the choice is temporary

A recipe column would make the choice permanent for a recipe. Then a recipe without automatic AI could not take part in a later automatic run. The add is the unit of the choice. Then the value is part of the add.

The `recipeBecameUsable` event gets an optional `autoEnrich` true/false value. If the value is absent, it is on. Then each source before this value keeps its operation. The enrichment program is not a switch for all recipes. It decides for each event.

During a release, a system before the value can get an off event and start the work. The event is temporary. Then the effect is only the time of the deployment. Each system obeys the value after the release.

## Decisions

- The choice is `autoEnrichOnAdd`, a true/false value in the profile file, not in a new column.
- The per-add override is a temporary value on the internal event. It is not a recipe column.
- Enhanced runs `auto-tagging`, `auto-categorization`, `nutrition-estimation`, `recipe-provenance`, `ingredient-linking` and `image-generation`. `allergy-detection` is manual only.
- If an add does not give a choice, the system reads the profile choice. Then each program that uses the API and the Quick Import extension get the same standard.
- The recipe file import does not have the value. It keeps its operation. Its item is part of another change.

## Not in this change

- Many recipe import items and the recipe file import.
- Changes to the person who controls the system and the automatic controls for each kind.
- An item for each recipe and the choice.

## Acceptance

- The choice is on at the start. It is a true/false value. It changes through the procedure. The profile query returns it.
- The options area shows the switch and a short note. A change writes `autoEnrichOnAdd`.
- Each add area starts from the choice and sends its choice.
- On starts the automatic work one time for each recipe and kind. Off starts none.
- Manual enrichment does not change.
- The event works when `autoEnrich` is absent.
