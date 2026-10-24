# 15: The pass asks AI once

**What to build:** The background pass (07) asks AI one question per food instead of two (read, then compare). AI says what the name is, and the code looks that up in the catalogue (Mike, 2026-10-20: "reversing the question perhaps so letting ai decide and we do a bit of fuzzy matching").

- **The one question** sends no catalogue. It asks what the name is:
  - its plain English name, the more general food it is a kind of, and two or three other names a shop sells it under; or
  - several foods: each part named, in the language written, and whether they go together or are alternatives; or
  - not a food.
  
  AI also says whether it is sure.
- **The code decides**, with the matching an import uses (translations, plurals, preparation, slips):
  - **One food matches** the English name or another name: the food is merged into it. "Unox Knaks" is read as "frankfurter", and the catalogue has frankfurter.
  - **Nothing matches, but the general food does:** it stays a food of its own, filed under that one. "rode uien" is read as "red onion" with general food "onion"; with no red onion in the catalogue, it goes under onion.
  - **Neither:** a food of its own. The Plain Name step follows as today.
  - **Several:** each named part is resolved as an import resolves it, and the food is split into them when AI is sure (08). The answer lists the parts, and so does the job monitor's step: "Dijon or yellow mustard" into "Dijon mustard" and "yellow mustard". Unsure, it stays one food, flagged.
  - **Not a food:** deleted, as in 13.
- **An unsure answer** is applied and flagged, as today. Undo memory is checked as today.
- **Only when the lookup is ambiguous**, when the names match more than one food, is the second question asked over just those foods. That is the Decision where it is on, else the language model.
- **The prompt:** the administrator-editable `ingredient-resolution` prompt is rewritten for the one question. The release notes tell an administrator who edited it to compare theirs with the new default.

**Blocked by:** 14, which leaves the pass as the only place rung 3 runs.

**Status:** done

- [x] "Unox Knaks" with frankfurter in the catalogue: one AI request, merged into frankfurter.
- [x] "rode uien" with onion but no red onion: one request, a food of its own under onion.
- [x] "Dijon or yellow mustard", sure: one request, split into the two mustards it names. Unsure: one food, flagged.
- [x] "melted": one request, deleted.
- [x] A name whose reading matches two foods: two requests, and the second answer decides.
- [x] The job monitor's step shows what AI read the name as, and for several foods the parts.
- [x] Pass tests mock AI at `generateStructured` and `decide`, against a real database.
- [x] All `CONTRIBUTING.md` gates pass.

## Comments

2026-10-20, implemented:

- One `generateStructured` request under `ingredient-resolution` reads the name: `food` (englishName, generalFood, otherNames), `several` (parts, joined) or `not-a-food`, with `sure`. No catalogue is sent.
- `findOtherFoodsNamed` in the resolver looks the names up as an import does (rungs 1–2, then a slip), never finding the food itself; `findOtherIngredientsFor` (the startup recheck) is the same lookup without slips. A spelling folds to one alias, so a single name finds at most one food: ambiguity only arises across the English name and the other names.
- More than one food found: the second question offers just those foods plus "none of these" (Decision at `RESOLUTION_THRESHOLD`, else the language model, `{ food, sure }`). A merge is sure only when the reading and the pick both are. "None" falls through to the general food.
- The Plain Name step still follows a parent or a food of its own, as before; the "one request" counts above are `ingredient-resolution` requests.
- The job monitor step's trace is `{ englishName, parts, considered }`: `parts` for several foods, sure or not; `considered` only when a second question was asked.
- Gone: the word-start candidate search (`findIngredientCandidates`, `findIngredientsNamed`, `withParents`, `MAX_CANDIDATES`), the comparing verdicts (same/kind-of/new) and the Decision's several/not-a-food options. A candidate's parent is no longer offered: "knakworst" read as frankfurter now merges into frankfurter.
- Test trap fixed on the way: `review.test.ts`'s `flagged()` queues `isAIEnabled` once; a text that mints nothing left it unread and the next test saw AI off. The mock is now reset per test.
- Release notes: an upgrade note for an edited prompt. ADR-0037 amended; CONTEXT.md's Ingredient Alias no longer says the import asks AI.


2026-10-20, review fixes:

- A "none of these" the language model is not sure of now flags the food; before, it fell through to the general food as sure. A number off the list counts as unsure too.
- A food found only through a slip of AI's own names ("cherry" finding "sherry") is merged or parented unsure, so it is flagged for a person. AI's names are clean English, so a slip there is more likely a false friend than a typo.
- The trace also carries `generalFood` and `otherNames`, so the job monitor shows the whole reading (`noTrace()` in the shared contracts builds an empty one).
- The second question returns one `{ ingredientId | null, sure }` pick, and the general food is looked up only when no name found a food. `findOtherIngredientsFor` went: the startup recheck calls `findOtherFoodsNamed` without slips. It now also skips texts that name no food, which never matched anything.
- Not changed: a failed second question still leaves the food unanswered (`ai-unavailable`, asked again nightly) rather than filing it under the general food, since AI never said which food it was. The E2E stubs keep their inline JSON; they can't import the shared-server test helper.
