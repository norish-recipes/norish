# 51: The spelling check reads a merge from the same start, and a comma fragment alone

**What to build:** Found by ticket 31's run after tickets 32-48 (2026-10-22, HEAD fa3fb4295, `m48_post_on`). Ticket 46's spelling check asked 252 seeded foods and changed 9 spellings. Two of the results are wrong:

- **A merge from the same start is undone.** The first pass merged an own brand food into seeded noodle, unsure (its spellings moved onto noodle, noodle flagged). The spelling check then ran on noodle, read those 2 spellings as another food, and removed them. Their line was minted again, renamed, and filed, sure, under mixed spices. On the copy: 1 food, 1 line; the merge still shows as an open AI Change, noodle stays flagged, and the new parent is wrong. To decide: the spelling check skips spellings an AI Change moved in (they are AI's already), or runs before the pass.
- **A comma fragment is judged by its words.** "organic plain" (cut from a Greek yogurt line at the comma in 0.25) was moved from greek yogurt to plain yogurt, so the line left the right food. On the copy: 1 spelling, 1 line. The check shows AI the spelling without the line it came from.

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-23)

"build all except 66". The spelling check skips the spellings an AI Change moved onto a food in the same first start (AI already judged them). For the rest it shows AI one recipe line that uses the spelling, so a comma fragment is judged with the line it came from.

## Implemented (2026-10-23)

- `checkSpellingsOf` (`ingredients/spelling-check.ts`) leaves out the spellings `listAliasIdsAIMovedOnto(id)` (`db/repositories/ingredient-ai-changes.ts`) names: the `aliasIds` of a merge not undone listed under the food, and the spelling of a spelling move (kind `spelling`) whose `targetId` is the food. No time bound for "this start": the check runs once per `SPELLING_CHECK_VERSION`, and AI Changes exist only since this release, so every one it finds is from the run it belongs to; one from an earlier pass is AI's judgement just the same.
- Narrowed by ticket 71 (2026-10-23): of a merge only the merged food's name is skipped (`listNamesAIReadOnto`, by fold); the other spellings it carried along are checked.
- Each spelling goes to AI with one recipe line written with it, `findRowsNamingSpellings(tx, [aliasId]).lines[0].name`, as `   Line: …` under its entry in `Spellings:`. `askWhatSpellingsName` takes `{ text, line }[]`. The prompt says so in one clause; the admin prompt description says so in all 16 locales.
- `SPELLING_CHECK_VERSION` stays 1: the check has not shipped in a release, so no instance needs it run again.
- Tests (`spelling-check.test.ts`): "shows AI a recipe line written with each spelling, so a fragment is read in its line" and "leaves the spellings a merge by AI moved onto the food, which AI already judged". Release-notes line beside ticket 46's. No ADR or CONTEXT.md line: ticket 46 put none there.
