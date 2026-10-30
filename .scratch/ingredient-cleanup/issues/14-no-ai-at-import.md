# 14: Import asks no AI

**What to build:** A recipe import or save, a typed grocery, a recurring grocery and a Pantry add resolve a name without AI. Mike, 2026-10-20: "needs to be dropped for sure". Only the background pass (07) asks AI, moments after the mint.

- **What still finds a food at import**, AI on or off:
  - a translation Norish already has, with plurals, amounts, units and preparation read past ("4 el bosui", "onions, diced");
  - the joining words ("zout en peper" is zout and peper);
  - a slip of the fingers ("barmezaan" is parmezaan). It is taken at once, as AI off takes it today (Mike, 2026-10-20: "with the fuzzy matching indeed should be quite reliable"). The pass never sees it.
- **Anything else** becomes a new ingredient, flagged, and the pass decides about it.
  - The flag's copy says AI looks at it shortly, not that AI was not asked.
  - With AI off it is `ai-off`, as today.
- **What goes:**
  - rung 3 at import: the Decision and the language model;
  - the 8-second budget (`RESOLUTION_BUDGET_MS`);
  - the unsure join at import.
- **What the pass now does instead of the import:**
  - "Dijon or yellow mustard" is minted whole, and the pass splits it when AI is sure;
  - "melted" and "deegroller" are minted, then deleted by the pass as not a food. Each is listed on Changed by AI with Undo. This replaces ticket 13's "nothing is minted, and nothing is listed on Changed by AI" at import.

**Blocked by:** 13, 09 (both done)

**Status:** done

- [x] A recipe saved with AI on makes no AI request while it saves; the pass makes them afterwards.
- [x] "barmezaan" in a recipe points at parmezaan when the recipe is saved, AI on or off.
- [x] "rode uien" with no translation for it becomes its own flagged ingredient. The pass then files it under onion.
- [x] "melted" in a new recipe is minted, then deleted by the pass. It shows on Changed by AI, and Undo brings it back with its line.
- [x] Adding a grocery never waits on AI.
- [x] `resolver-ai.test.ts`'s import-time cases move to the pass's tests or go. E2E stubs that answered import questions answer the pass instead.
- [x] Release notes and the Ingredients docs page say nothing of AI at import.
- [x] All `CONTRIBUTING.md` gates pass.

## Comments

2026-10-20, implemented:

- The resolver asks no AI: rungs 1–2, the words' split, then a slip (taken AI on or off), then a flagged mint. Its flag is the new `ai-queued` ("New to Norish. AI looks at it shortly."), `ai-off` with AI off, `upgrade` for the startup passes, as before.
- Gone: rung 3 at import with the words-against-AI settling (`settleWithWords`, `decideBetween`, `wordsParent`, `slipOf`), the `thorough` switch (the pass always reads first), `RESOLUTION_BUDGET_MS`, `findIngredientCandidatesById`, the unsure join (`addIngredientAliases`'s `unsure`) and the AI-guessed parent at mint (`parentUnsure: "ai"`).
- The nightly pass also asks foods still flagged `ai-queued`, so one whose pass was lost (Redis down at mint, AI off when it ran) does not keep "shortly" for ever.
- `resolver-ai.test.ts` now drives a save with AI on: no request, then the pass files "rode uien" under onion and deletes "melted" with Undo. The Decision threshold, refused key, budget and crowded-word cases moved to `review.test.ts`; the rest went with the code.
- E2E: the merge scenario no longer queues an import answer; the other two only had their comments fixed.
- ADR-0037 amended, reversing the slip amendment's "with AI on a slip is never taken alone": "cherry" beside "sherry" now joins it unasked, and a person moves it.

2026-10-20, review fixes:

- A food waiting on its pass (`ai-queued`) says `ai-off` when AI was switched off before the pass ran.
- Tested: a split into parts nothing knows mints them `ai-queued`, each handed to a pass of its own. A part's own pass may split it again, sure only.
- The nightly reasons are one constant (`RETRIED_FLAG_REASONS`); `unknown-food` is no longer set (old rows keep its copy); `ai-unavailable`'s copy lost "when this name was added".
