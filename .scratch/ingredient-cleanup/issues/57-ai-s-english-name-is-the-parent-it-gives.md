# 57: AI's English name is the parent it gives, so a food stays its own food under itself

**What to build:** Found by ticket 31's run after ticket 56 (2026-10-22, HEAD 44297d433, `m56_post_on`). Ticket 56's rule files a name under AI's parent when AI's names find that same food. It was meant for an other name that happens to be the parent's spelling (italian sausage, "salsiccia"). It also fires when AI's English name itself is a spelling of the parent, and then the reading says the food is its own parent:

- 4 own foods whose English name is a seeded spelling of the parent AI gave (a Dutch "edamame beans" under edamame, "flour tortilla" under wheat tortilla, "smoked paprika powder" under smoked paprika, "chorizo sausage" under chorizo). Last run merged all 4, sure. 8 recipe lines now name a near-duplicate.
- 4 brand products whose English name and parent are both the general food (hot sauce, cream cheese, pesto, margarine). Ticket 50 decided these merge into the general food; ticket 56's note expected the `parent` describe to keep AI from naming the brand's own food as its parent, and here it does not. Last run merged 3 of them, sure. 5 lines.

To decide: does the rule hold only for an other name (the English name finding the parent still merges), or does a reading whose English name finds the parent count as AI saying "this is that food"?

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-22)

The rule overshoots: "a food is never merged into the parent AI gave it" does not hold when AI's English name is the parent itself. Then the name is that food and it merges (englishName "chicken thigh", parent "chicken thigh" merges into chicken thigh).

## Implemented (2026-10-22)

- First as string equality (`namesTheSame`, English name folded equal to the parent), then, on the orchestrator's follow-up, as the rule's intent: in `readThenLookUp` (`packages/shared-server/src/ai/resolution/ingredient-resolution.ts`) the parent lookup is skipped when AI's English name itself found the food by its own spelling. `findNamed` returns `byFirstName` (the first name looked up, the English name in `namesOf`, found the picked food exactly), taken from `findOtherFoodsNamed`'s per-name results, so no second query.
- Ticket 56's rule now holds only for a food AI's other names or a slip found and that is the reading's parent: pumpkin puree via "pureed pumpkin", italian sausage via "salsiccia", Tenderstem via "broccolini". "edamame beans" under edamame, "chorizo sausage" under chorizo and the equal-string case ("chicken thigh" under chicken thigh) merge. The brand products (hot sauce, cream cheese, pesto, margarine) merge where AI's English name is the general food.
- Tests in `review.test.ts` "AI's names, looked up as written": kippendijen merges into chicken thigh, edamame bonen into edamame; pumpkin puree and italian sausage stay under their parent.
- Release-notes line and the ADR-0037 ticket-56 amendment say the narrowed rule; ticket 56's implemented section points here.
