# 24: AI answers in one checked shape

**What to build:** Found by ticket 12. AI's reading of a name is a flat object whose fields may all be empty whatever the verdict, and "several" is defined only for names joined by "and" or "or". So "salt cinnamon" and "koud water melk", two foods side by side, had nowhere to go and were answered "not a food" while AI was unsure, and deleted. Mike, 2026-10-21: the answer gets a shape the code can check.

- **The shape:** `sure`; `action` with `kind` ("food", "several" or "not-a-food"), `joined` ("together" or "alternatives", for several) and `reason` ("equipment", "preparation", "note" or "gibberish", for not a food); and `foods[]`, each with `written` (in the language written), `englishName`, `parent` (ticket 27) and `otherNames`.
- **Checked by the code:** a food has one entry in `foods`, several have two or more and a `joined`, not a food has none and a `reason`. An answer that breaks this is asked once more, then the food is flagged. One flat object, not a choice of schemas, since OpenAI's strict mode refuses a choice at the top.
- **The prompt:** several foods also covers foods written side by side with no joining word ("salt cinnamon" is salt and cinnamon).
- **A split's parts** are looked up by their English names and other names, as a single food is.
- **Upgrade notes:** an administrator who edited the `ingredient-resolution` Prompt checks it against the new answer.

**Blocked by:** None

**Status:** done

- [x] "salt cinnamon" and "koud water melk" are split into their foods, not deleted.
- [x] An answer that breaks the shape is asked once more, then flagged.
- [ ] All `CONTRIBUTING.md` gates pass. (shared-server tests, typecheck and lint, the queue's review tests, `i18n:check`, `build:web` and the `ai` E2E spec `ingredient-catalogue.e2e.ts` pass; the full repo gates are the orchestrator's run)

2026-10-21, implemented:

- The schema is `readingSchema` in `packages/shared-server/src/ai/resolution/ingredient-resolution.ts`: `{ sure, action: { kind, joined, reason }, foods: [{ written, englishName, parent, otherNames }] }`, all fields present, nullable where empty (OpenAI strict mode). `checked(answer)` turns it into a `Reading` or null; `readName` asks a second time when null.
- Twice broken: the food is flagged `ai-unavailable` (no new reason, no new strings). It is "failed" in that reason's own words, and the nightly sweep asks it again, so a fixed prompt recovers it by itself. Cost ceiling: two requests per such food per night while an edited prompt keeps breaking the shape. Mike may prefer `ai-unsure` (a person checks it, never re-asked).
- `parent` (ticket 27) is wired as the old general food: the code looks it up with `findOtherFoodsNamed` as before (since the 26 review fix, through `findNamed`), and the trace still calls it `generalFood`. The prompt's `parent` wording is today's "more general food it is a kind of"; 27 rewrites it and adds "Filed under".
- `action.reason` is required by the check and logged, not used further.
- The lookup of AI's names is one function, `findNamed` (names = englishName + otherNames, `findOtherFoodsNamed`, the second question where they find 2+ foods, a slip-only find unsure). A single food and each part of a split go through it; ticket 26's scored lookup changes it in one place.
- A split's part: `AIResolution` several carries `parts: ReadPart[]` (`{ text: written, found: IngredientRef | null }`). A part found surely by its names points at the alias its name matched (nothing is added to that food); a part found by nothing, or only unsurely, resolves its written text as before (`resolveIngredients` in `review.ts`'s `split`, minting it flagged). An unsure split is not looked up at all. The food itself is never found by its names (`findOtherFoodsNamed` excludes it), so ticket 29's case still reaches the written fallback and the "part is the food itself" refusal.
- `findOtherFoodsNamed` now returns `IngredientRef & { slip }` (aliasId added); `findSlips` returns the slip's alias row instead of its food id.
- Prompt: several also covers foods side by side ("salt cinnamon", "koud water melk"). Tests: `review.test.ts` "splits foods written side by side, finding each part by its English name and other names" and "an answer that breaks its shape". The test helper `__tests__/helpers/ingredient-readings.ts` builds the new shape (`foodReading({ englishName, parent, otherNames, written })`, `severalReading(parts as strings or { written, englishName, ... })`).
- Docs: the 0.26 upgrade note on the Ingredient resolution prompt names the new answer and what a broken one does; the Ingredients page names "salt cinnamon".
