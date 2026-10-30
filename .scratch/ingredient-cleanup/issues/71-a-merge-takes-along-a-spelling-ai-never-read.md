# 71: A merge takes along a spelling AI never read

**What to build:** Found by ticket 31's run after tickets 51-53, 65, 67, 68 and ticket 60's round 2 (2026-10-23, HEAD 814c23937, `m68_post_on`). AI read an own brand food's short name as plain noodles, sure, and merged it into seeded noodle. Its spellings went along, and one of them, the longer product name, is a noodle seasoning mix (AI read it that way, unsure, last run). Ticket 51 now leaves out the spellings a merge moved in, so the spelling check no longer takes it off noodle, and its line names noodle. Last run the check took both spellings off.

On the copy: 1 food, 1 recipe line; noodle holds the 2 spellings.

To decide: AI's merge reads the spellings it moves, or the spelling check still reads moved spellings that differ from the name AI read.

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-23)

First left alone as one-run variance, then reopened: it went wrong in m68, m70a, m70b and m74, every run, one of the few regressions against 0.25 (`~/Documents/norish-ticket-31/compare-025.md`). Mike approved the orchestrator's plan: the spelling check skips only the spelling AI read in the merge; the other spellings the merge carried along are still checked.

## Implemented (2026-10-23)

- The merge's AI Change holds the merged food's name (`undo.name`), which is what AI read. `listAliasIdsAIMovedOnto` became `listNamesAIReadOnto` (`db/repositories/ingredient-ai-changes.ts`): a merge's `undo.name`, a spelling move's `undo.spelling.text`. `checkSpellingsOf` skips a spelling whose fold is the food's name's or one of those names' folds, by fold, not alias id.
- Test (`spelling-check.test.ts`): "checks the other spellings a merge by AI carried along, which AI never read" (Verstegen noedels into seeded noodle; only the World Spice Meals spelling is asked, and taken off). The release-notes sentence of ticket 51 now says the carried-along translations are checked.
