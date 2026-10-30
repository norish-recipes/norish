# 38: The second question picks an unrelated slip

**What to build:** Found by ticket 31's final run (2026-10-22, HEAD 0dab43bd8). With AI on, one of ticket 26's two cases was merged again into the unrelated food ticket 26 named, unsure. AI's reading was right (its English name and parent are a different dish), none of its names is a food in the catalogue, so the one slip was put to the second question, and this time the answer picked it instead of "none of these". The two earlier runs of ticket 31 answered none; the answer varies per run.

- On the production copy: 1 unsure merge into an unrelated food, its recipe lines now on that food until someone presses Undo; the target flagged `ai-unsure`.
- To decide: whether a slip only becomes a candidate when it is near AI's name (not only the food's own spelling), or the second question is put to the language model rather than the Decision, or a slip AI picks stays a suggestion instead of a merge.

**Blocked by:** None

**Status:** done

- [ ] A food whose AI names find only an unrelated slip is not merged into it. (Left to a measurement rerun with the real models.)

## Decided (Mike, 2026-10-22)

Fix 1: the second question gets AI's reading. Plain labelled facts only, no phrasing ("parent", never "a kind of" or "filed under").

## Implemented (2026-10-22)

- `findNamed` (`packages/shared-server/src/ai/resolution/ingredient-resolution.ts`) takes an `Asked` (`name` as written + `readAs`: englishName, parent, category). Single foods and split parts pass their reading; parent and category lookups pass nulls (the name is AI's parent name itself). One code path into `askWhich` → `decideFood` / `askLanguageModel`.
- `FoundFood` (`ingredients/resolver.ts`) carries `matched`: the alias text (or food name) that found it; `findIngredientCandidatesByIds` now returns `parent` (the parent food's name). Candidates are `IngredientCandidate & { matched }`; `matched` is omitted where it is the food's name, `alsoKnownAs` / `also:` are the other spellings without it, capped at `SHOWN_ALIASES` (5).
- Decision state for "rode pesto": `{ name: "rode pesto", englishName: "red pesto", parent: "pesto", foods: [{ name: "red port", parent: "port", matched: "porto rosso", alsoKnownAs: ["rode port", ...] }] }` (null fields dropped). Instructions say what `matched` is and that a name only spelled like a food is a different food.
- Language model sections: `Name: rode pesto`, `English name: red pesto`, `Parent: pesto`, `Category: sauce` (each only when set), then `Foods in the catalogue it may be:\n1. red port (parent: port; matched: porto rosso; also: rode port)`.
- The reading question's current-parent section is now `Parent: whey` (was `Filed under: whey`), its own commit. Default prompt text and the 0.26 upgrade note on the Ingredient resolution prompt updated for both.
- Tests: `review.test.ts` "a reading only a slip of the fingers finds" checks both the Decision state and the LM sections.
- Not checked: whether Jev/gpt-6-luna now answer none for "rode pesto" — left to a measurement rerun.
