# 26: Unsure merges land on an unrelated food

**What to build:** Found by ticket 12. With AI on, the pass made 5 unsure merges on the production copy. Two of them join a food to an unrelated one: "rode pesto" into red port, and "sriracha sauce" into oyster sauce. Their recipe lines now name the wrong food until someone presses Undo. An unsure answer is applied by design (flagged, with Undo), but these two are not near misses. The others ("koffiewater" into water, "refried beans" into red bean, "tortilla's" into tortilla) are close.

**Why:** AI read "rode pesto" as "red pesto" (under pesto) and "sriracha sauce" as sriracha (under hot sauce), sure. None of its names is a food in the catalogue, so the lookup fell back to a slip of the fingers, which took red port and oyster sauce. With one food found, AI was never asked about it, and the merge was made unsure.

**Fix (Mike, 2026-10-21):** the fuzzy matcher returns a scored list. `nearestSlip` already scores every name in reach (how far apart, from both sides) and then keeps only the nearest, or nothing where two different foods tie. It becomes a list of every food within a slip, with its score, best first; the grocery product rule keeps reading the first.

- The lookup of AI's names gives each food found a score: an exact spelling is 1, a slip its closeness.
- An exact match is taken; slips beside it are ignored.
- Only slips found: they are put to AI as the numbered list, best score first, with "none of these", even when only one was found. The best slip is not taken unasked, since red port was the best slip for "red pesto". One more request per such food (5 on the copy).
- AI off: the best slip, as today.

**Blocked by:** None

**Status:** done

- [x] "rode pesto" and "sriracha sauce" are not merged into red port and oyster sauce; asked, AI answers none.
- [x] "tortilla's" is still merged into tortilla.
- [x] An exact match beside a slip is taken without a second question.
- [ ] All `CONTRIBUTING.md` gates pass.

2026-10-21, implemented:

- `@norish/shared/lib/name-slips`: `slipsNear(wanted, items, nameOf, thingOf)` returns `Scored<T>[]` (`{ item, score }`, score = 1 - how far apart), one per thing by its nearest item, best first. `onlyNearest(list)` is the best unless two things tie (today's rule); `nearestSlip` is `onlyNearest(slipsNear(...))`, so the grocery product rule and an import (AI off) are unchanged.
- `findOtherFoodsNamed` (resolver) now returns `FoundFood[][]`: per text, `[{ aliasId, ingredientId, score: 1 }]` for its own spelling, else every food a slip away best first, else `[]`. `findSlips` returns these lists per spelling key; `resolveTexts` takes `onlyNearest`. `FoundFood` is exported from the resolver.
- `findNamed`: an exact spelling of any of AI's names is taken and slips beside it ignored (2+ exact foods are still asked which). Slips alone, even one, go to the existing second question (`askWhich`: Decision, else the language model's numbered list with null for none), best first; the candidates are put in that order (the repository returned them in DB order before). No new prompt; the default prompt's last paragraph now says the second question also comes for foods "spelled a letter or two apart", nearest first.
- A slip AI picks is still an unsure merge (flagged, Undo), as before. Mike may prefer it sure now that AI was asked; I kept the person's check. Superseded by ticket 54 (2026-10-22): sure where the Decision picks it at 0.9 or more, or the language model says sure.
- Review fix (2026-10-21): the parent goes through `findNamed` too (`findNamed(food.parent, excludeId, [food.parent], trace)`): an exact spelling is taken, slips alone go to the second question with none-of-these, asked about the parent's name. A slip parent AI picks is unsure, as a slip merge is. The separate `onlyNearest` path is gone. Test: "asks about a parent only a slip finds, and files it unsure under the one AI picks". `recheck-mints` reads `found.flat()`.
- Cost (ticket 31): one more resolution request per food whose AI names find only slips (the ticket's estimate: 5 on the copy), and per parent only slips find.
- Budget (review fix): the 30 s budget over the whole question is gone; each request (reading, Decision, language model) has its own `REQUEST_BUDGET_MS` (10 s, `ingredient-resolution.ts`), so a split asking about every part is not flagged unanswered, and a Decision that hangs falls back to the language model.
- Tests: `review.test.ts` "a reading only a slip of the fingers finds" (one slip asked and none kept, every slip listed nearest first, a slip AI picks merges unsure, exact beside a slip takes one request); the zucchini slip case now queues a Decision. `packages/shared/__tests__/lib/name-slips.test.ts`. The test pairs ("porto rosso" for AI's other name "pesto rosso", "sambal oelek"/"sambal olie" for "sambal olek") were picked by computed distance: "red pesto" is not a slip of "red port" by name alone, so the production find went through a spelling the test cannot know.
- Docs: a release-notes line, the 0.26 upgrade note on the Ingredient resolution prompt names the second question's new case, and the Ingredients page's merge bullet.
